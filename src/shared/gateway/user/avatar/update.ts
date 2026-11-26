import "@tanstack/react-start/server-only";
import { users } from "@schema";
import {
  Context,
  DateTime,
  Effect,
  Layer,
  Match,
  Option,
  Schema,
} from "effect";
import { eq, isNull } from "void/db";
import type { SQL } from "void/db";
import {
  avatarContentMatchesMime,
  avatarExtensionForMime,
  isOwnAvatarKey,
} from "@/lib/storage/avatar-validation";
import { reportError } from "@/shared/gateway/report-error";
import { avatarUrlForKey } from "@/shared/gateway/user/avatar-url";
import {
  orNone,
  readUserRow,
  succeeded,
  writeUserRow,
  wroteOneRow,
} from "../persistence.ts";
import type { UserPersistenceError } from "../persistence.ts";
import { AvatarBucket, AvatarKeyIds } from "./bucket.ts";

export class AvatarTypeUnsupported extends Schema.TaggedError<
  AvatarTypeUnsupported,
  { readonly brand: unique symbol }
>()("AvatarTypeUnsupported", {}) {}

export class AvatarUploadFailed extends Schema.TaggedError<
  AvatarUploadFailed,
  { readonly brand: unique symbol }
>()("AvatarUploadFailed", {}) {}

/** An uploaded object the rollback delete failed to remove from the bucket. */
class AvatarObjectOrphaned extends Schema.TaggedError<
  AvatarObjectOrphaned,
  { readonly brand: unique symbol }
>()("AvatarObjectOrphaned", { message: Schema.String }) {}

/** A stored key the cleanup refused, because it names no object of this owner's. */
class AvatarKeyNotOwned extends Schema.TaggedError<
  AvatarKeyNotOwned,
  { readonly brand: unique symbol }
>()("AvatarKeyNotOwned", { message: Schema.String }) {}

export interface AvatarUpdated {
  readonly avatarUrl: string;
  readonly cleanup: "complete" | "pending";
}

/**
 * The condition that the row still holds `previousKey`. SQL's `=` never
 * matches a null, so a row read with no key is matched with `is null`.
 */
const avatarKeyStillHeld = (previousKey: Option.Option<string>): SQL =>
  Option.match(previousKey, {
    onNone: () => isNull(users.avatarKey),
    onSome: (read) => eq(users.avatarKey, read),
  });

/**
 * The `avatar_key` column of a user's own row.
 *
 * A service rather than a direct query so a test drives the rollback arms
 * without a D1 binding.
 */
export class UserAvatarKeys extends Context.Service<
  UserAvatarKeys,
  {
    readonly find: (
      userId: string
    ) => Effect.Effect<
      Option.Option<Option.Option<string>>,
      UserPersistenceError
    >;
    /**
     * Points the row at `avatarKey` only while it still holds `previousKey`,
     * the key `find` returned, and reports the rows touched: zero once another
     * write has replaced that key in between.
     */
    readonly set: (
      userId: string,
      previousKey: Option.Option<string>,
      avatarKey: string,
      updatedAt: DateTime.Utc
    ) => Effect.Effect<number, UserPersistenceError>;
  }
>()("my-app/shared/gateway/user/avatar/update/UserAvatarKeys") {
  static readonly layer = Layer.succeed(
    UserAvatarKeys,
    UserAvatarKeys.of({
      find: (userId) =>
        readUserRow(userId).pipe(
          Effect.map(Option.map((row) => Option.fromNullOr(row.avatarKey)))
        ),
      set: (userId, previousKey, avatarKey, updatedAt) =>
        writeUserRow(
          userId,
          { avatarKey },
          updatedAt,
          avatarKeyStillHeld(previousKey)
        ),
    })
  );
}

/**
 * Replaces a user's avatar object and the key their row points at.
 *
 * The previous object is removed only after the row update has reported one
 * touched row, so a failure between the two leaves an unreferenced object
 * rather than a row referencing a deleted one. The update applies only while
 * the row still holds the key this call read, so of two uploads that read the
 * same key one wins, and the other removes its own new object and answers
 * `AvatarUploadFailed` through the same rollback as any other missed write.
 */
export class AvatarWriter extends Context.Service<
  AvatarWriter,
  {
    readonly replace: (
      userId: string,
      file: File
    ) => Effect.Effect<
      AvatarUpdated,
      AvatarTypeUnsupported | AvatarUploadFailed
    >;
  }
>()("my-app/shared/gateway/user/avatar/update/AvatarWriter") {
  static readonly layerNoDeps = Layer.effect(
    AvatarWriter,
    Effect.gen(function* () {
      const bucket = yield* AvatarBucket;
      const keyIds = yield* AvatarKeyIds;
      const keys = yield* UserAvatarKeys;

      const replace = Effect.fn("AvatarWriter.replace")(function* (
        userId: string,
        file: File
      ) {
        const fileExt = avatarExtensionForMime(file.type);
        if (Option.isNone(fileExt)) {
          return yield* AvatarTypeUnsupported.make();
        }
        const contentMatches = yield* Effect.promise(() =>
          avatarContentMatchesMime(file)
        );
        if (!contentMatches) {
          return yield* AvatarTypeUnsupported.make();
        }

        const current = yield* orNone(
          "user.findAvatarKey",
          keys.find(userId)
        ).pipe(Effect.map(Option.flatten));
        if (Option.isNone(current)) {
          return yield* AvatarUploadFailed.make();
        }

        const previousKey = current.value;
        const keyId = yield* keyIds.next;
        const key = `${userId}/avatars/${keyId}.${fileExt.value}`;

        const uploaded = yield* succeeded(
          "user.upload",
          bucket.put(key, file, file.type)
        );
        if (!uploaded) {
          return yield* AvatarUploadFailed.make();
        }
        const publicUrl = avatarUrlForKey(key);

        const updatedAt = yield* DateTime.now;
        const wrote = yield* wroteOneRow(
          "user.setAvatarKey",
          keys.set(userId, previousKey, key, updatedAt)
        );
        if (!wrote) {
          const rolledBack = yield* succeeded(
            "user.rollbackUpload",
            bucket.remove(key)
          );
          yield* Match.value(rolledBack).pipe(
            Match.when(true, () => Effect.void),
            Match.when(false, () =>
              reportError(
                "user.rollbackUpload",
                AvatarObjectOrphaned.make({
                  message: `${key} was left in the bucket`,
                })
              )
            ),
            Match.exhaustive
          );
          return yield* AvatarUploadFailed.make();
        }

        if (Option.isNone(previousKey)) {
          return {
            avatarUrl: publicUrl,
            cleanup: "complete",
          } satisfies AvatarUpdated;
        }
        // The column is the only value on this path the gateway did not
        // build, so ownership is established here rather than assumed.
        if (!isOwnAvatarKey(previousKey.value, userId)) {
          yield* reportError(
            "user.removePrevious",
            AvatarKeyNotOwned.make({
              message: `${previousKey.value} does not belong to ${userId}`,
            })
          );
          return {
            avatarUrl: publicUrl,
            cleanup: "pending",
          } satisfies AvatarUpdated;
        }
        const removedPrevious = yield* succeeded(
          "user.removePrevious",
          bucket.remove(previousKey.value)
        );
        return {
          avatarUrl: publicUrl,
          cleanup: Match.value(removedPrevious).pipe(
            Match.when(true, (): AvatarUpdated["cleanup"] => "complete"),
            Match.when(false, (): AvatarUpdated["cleanup"] => "pending"),
            Match.exhaustive
          ),
        } satisfies AvatarUpdated;
      });

      return AvatarWriter.of({ replace });
    })
  );

  static readonly layer = AvatarWriter.layerNoDeps.pipe(
    Layer.provide(AvatarBucket.layer),
    Layer.provide(AvatarKeyIds.layer),
    Layer.provide(UserAvatarKeys.layer)
  );
}
