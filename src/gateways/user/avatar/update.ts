import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import {
  Context,
  DateTime,
  Effect,
  Layer,
  Match,
  Option,
  Schema,
} from "effect";
import { avatarUrlForKey } from "@/lib/avatar-url";
import { getDb } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import { reportError } from "@/lib/report-error";
import {
  avatarContentMatchesMime,
  avatarExtensionForMime,
  isOwnAvatarKey,
} from "@/lib/storage/avatar-validation";
import { AvatarBucket, AvatarKeyIds } from ".";
import { orNone, persistenceEffect, succeeded, UnexpectedRowCount } from "..";
import type { UserPersistenceError } from "..";

export class AvatarTypeUnsupported extends Schema.TaggedError<AvatarTypeUnsupported>()(
  "AvatarTypeUnsupported",
  {}
) {}

export class AvatarUploadFailed extends Schema.TaggedError<AvatarUploadFailed>()(
  "AvatarUploadFailed",
  {}
) {}

/** An uploaded object the rollback delete failed to remove from the bucket. */
class AvatarObjectOrphaned extends Schema.TaggedError<AvatarObjectOrphaned>()(
  "AvatarObjectOrphaned",
  { message: Schema.String }
) {}

/** A stored key the cleanup refused, because it names no object of this owner's. */
class AvatarKeyNotOwned extends Schema.TaggedError<AvatarKeyNotOwned>()(
  "AvatarKeyNotOwned",
  { message: Schema.String }
) {}

export interface AvatarUpdated {
  readonly avatarUrl: string;
  readonly cleanup: "complete" | "pending";
}

/**
 * The `avatar_key` column of a user's own row.
 *
 * A service rather than a direct query so a test drives the rollback arms
 * without a D1 binding. `set` reports the number of rows it touched, so the
 * caller can reject a write that addressed nobody.
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
    readonly set: (
      userId: string,
      avatarKey: string,
      updatedAt: DateTime.Utc
    ) => Effect.Effect<number, UserPersistenceError>;
  }
>()("app/gateways/user/avatar/UserAvatarKeys") {
  static readonly layer = Layer.succeed(
    UserAvatarKeys,
    UserAvatarKeys.of({
      find: (userId) =>
        persistenceEffect(() =>
          getDb()
            .select({ avatarKey: users.avatarKey })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
            .then((rows) =>
              Option.fromNullishOr(rows[0]).pipe(
                Option.map((row) => Option.fromNullOr(row.avatarKey))
              )
            )
        ),
      set: (userId, avatarKey, updatedAt) =>
        persistenceEffect(() =>
          getDb()
            .update(users)
            .set({ avatarKey, updatedAt: DateTime.toDateUtc(updatedAt) })
            .where(eq(users.id, userId))
            .returning({ id: users.id })
            .then((rows) => rows.length)
        ),
    })
  );
}

/**
 * Replaces a user's avatar object and the key their row points at.
 *
 * The previous object is removed only after the row update has reported one
 * touched row, so a failure between the two leaves an unreferenced object
 * rather than a row referencing a deleted one.
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
>()("app/gateways/user/avatar/AvatarWriter") {
  static readonly layerNoDeps = Layer.effect(
    AvatarWriter,
    Effect.gen(function* buildAvatarWriter() {
      const bucket = yield* AvatarBucket;
      const keyIds = yield* AvatarKeyIds;
      const keys = yield* UserAvatarKeys;

      const replace = Effect.fn("AvatarWriter.replace")(function* replace(
        userId: string,
        file: File
      ) {
        const fileExt = avatarExtensionForMime(file.type);
        if (Option.isNone(fileExt)) {
          return yield* new AvatarTypeUnsupported();
        }
        const contentMatches = yield* Effect.promise(() =>
          avatarContentMatchesMime(file)
        );
        if (!contentMatches) {
          return yield* new AvatarTypeUnsupported();
        }

        const current = yield* orNone(
          "user.findAvatarKey",
          keys.find(userId)
        ).pipe(Effect.map(Option.flatten));
        if (Option.isNone(current)) {
          return yield* new AvatarUploadFailed();
        }

        const previousKey = current.value;
        const keyId = yield* keyIds.next;
        const key = `${userId}/avatars/${keyId}.${fileExt.value}`;

        const uploaded = yield* succeeded(
          "user.upload",
          bucket.put(key, file, file.type)
        );
        if (!uploaded) {
          return yield* new AvatarUploadFailed();
        }
        const publicUrl = avatarUrlForKey(key);

        const updatedAt = yield* DateTime.now;
        const rowsTouched = yield* orNone(
          "user.setAvatarKey",
          keys.set(userId, key, updatedAt)
        );
        if (!Option.contains(rowsTouched, 1)) {
          if (Option.isSome(rowsTouched)) {
            yield* reportError(
              "user.setAvatarKey",
              new UnexpectedRowCount({
                message: `expected 1 row, got ${String(rowsTouched.value)}`,
              })
            );
          }
          const rolledBack = yield* succeeded(
            "user.rollbackUpload",
            bucket.remove(key)
          );
          yield* Match.value(rolledBack).pipe(
            Match.when(true, () => Effect.void),
            Match.when(false, () =>
              reportError(
                "user.rollbackUpload",
                new AvatarObjectOrphaned({
                  message: `${key} was left in the bucket`,
                })
              )
            ),
            Match.exhaustive
          );
          return yield* new AvatarUploadFailed();
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
            new AvatarKeyNotOwned({
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
