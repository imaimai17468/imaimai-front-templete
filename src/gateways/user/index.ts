import { Context, DateTime, Effect, Layer, Schema } from "effect";
import { UserWithEmailSchema } from "@/entities/user";
import type { UpdateUser, UserWithEmail } from "@/entities/user";
import { avatarUrlForKey } from "@/lib/avatar-url";
import { reportError } from "@/lib/report-error";
import {
  avatarContentMatchesMime,
  avatarExtensionForMime,
} from "@/lib/storage/avatar-validation";
import { r2AvatarBucket } from "../avatar-bucket.live";
import { drizzleUserStore } from "./drizzle-store.live";

/**
 * Turns a row's `DateTime.Utc` instants into the ISO-8601 strings of
 * `UserWithEmail` and throws when a field fails its check, such as an email the
 * session carried that is not an address.
 */
const encodeUserWithEmail = Schema.encodeSync(UserWithEmailSchema);

/**
 * A D1 row read or write, or an R2 object write, that did not complete.
 *
 * One type covers both services because nothing below discriminates them. The
 * avatar and name paths send it through `orNull` or `succeeded`, which log the
 * cause and branch on the result, and `fetchCurrentUser` leaves it in the error
 * channel for its caller to discharge.
 */
export class UserPersistenceError extends Schema.TaggedError<UserPersistenceError>()(
  "UserPersistenceError",
  { cause: Schema.Defect() }
) {}

/** A write the store reported as touching a number of rows nobody expects. */
export class UnexpectedRowCount extends Schema.TaggedError<UnexpectedRowCount>()(
  "UnexpectedRowCount",
  { message: Schema.String, rowsTouched: Schema.Number }
) {}

const persistenceEffect = <A>(
  run: () => Promise<A>
): Effect.Effect<A, UserPersistenceError> =>
  Effect.tryPromise({
    catch: (cause) => new UserPersistenceError({ cause }),
    try: async () => await run(),
  });

interface UserProfileRow {
  readonly id: string;
  readonly name: string | null;
  /** Better Auth's column, holding whatever the social provider supplied. */
  readonly image: string | null;
  /** The bucket key of an avatar this app uploaded, if there is one. */
  readonly avatarKey: string | null;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
}

/**
 * The user rows the gateway reads and writes.
 *
 * The gateway is written against this service rather than against a Drizzle
 * handle, so a test provides a fake layer without a D1 binding.
 */
export class UserStore extends Context.Service<
  UserStore,
  {
    readonly findProfile: (
      userId: string
    ) => Effect.Effect<UserProfileRow | null, UserPersistenceError>;
    readonly findAvatarKey: (
      userId: string
    ) => Effect.Effect<
      { avatarKey: string | null } | null,
      UserPersistenceError
    >;
    readonly updateName: (
      userId: string,
      name: string | null,
      updatedAt: DateTime.Utc
    ) => Effect.Effect<void, UserPersistenceError>;
    /** Number of rows the update touched, so the caller can reject a miss. */
    readonly setAvatarKey: (
      userId: string,
      avatarKey: string,
      updatedAt: DateTime.Utc
    ) => Effect.Effect<number, UserPersistenceError>;
  }
>()("app/gateways/user/UserStore") {
  static readonly layer = Layer.succeed(
    UserStore,
    UserStore.of({
      findAvatarKey: (userId) =>
        persistenceEffect(
          async () => await drizzleUserStore.findAvatarKey(userId)
        ),
      findProfile: (userId) =>
        persistenceEffect(
          async () => await drizzleUserStore.findProfile(userId)
        ),
      setAvatarKey: (userId, avatarKey, updatedAt) =>
        persistenceEffect(
          async () =>
            await drizzleUserStore.setAvatarKey(userId, avatarKey, updatedAt)
        ),
      updateName: (userId, name, updatedAt) =>
        persistenceEffect(async () => {
          await drizzleUserStore.updateName(userId, name, updatedAt);
        }),
    })
  );
}

/**
 * The write side of the avatar bucket.
 *
 * The gateway is written against this service rather than against
 * `r2AvatarBucket`, so a test provides a fake layer without a Cloudflare
 * environment. `upload` reports only whether the object was written, because
 * the URL that addresses it is derived from the key by `avatarUrlForKey`.
 */
export class AvatarStorage extends Context.Service<
  AvatarStorage,
  {
    readonly upload: (
      key: string,
      file: File | ArrayBuffer,
      contentType: string
    ) => Effect.Effect<void, UserPersistenceError>;
    readonly remove: (key: string) => Effect.Effect<void, UserPersistenceError>;
  }
>()("app/gateways/user/AvatarStorage") {
  static readonly layer = Layer.succeed(
    AvatarStorage,
    AvatarStorage.of({
      remove: (key) =>
        persistenceEffect(async () => {
          await r2AvatarBucket.delete(key);
        }),
      upload: (key, file, contentType) =>
        persistenceEffect(async () => {
          await r2AvatarBucket.put(key, file, contentType);
        }),
    })
  );
}

/**
 * The identifier that makes a new avatar key unique.
 *
 * A service rather than a direct `crypto.randomUUID()` call so a test fixes the
 * key the gateway writes.
 */
export class AvatarKeyIds extends Context.Service<
  AvatarKeyIds,
  { readonly next: Effect.Effect<string> }
>()("app/gateways/user/AvatarKeyIds") {
  static readonly layer = Layer.succeed(
    AvatarKeyIds,
    AvatarKeyIds.of({ next: Effect.sync(() => crypto.randomUUID()) })
  );
}

export class UserNameUpdateFailed extends Schema.TaggedError<UserNameUpdateFailed>()(
  "UserNameUpdateFailed",
  {}
) {}

export class AvatarTypeUnsupported extends Schema.TaggedError<AvatarTypeUnsupported>()(
  "AvatarTypeUnsupported",
  {}
) {}

/**
 * `orphanedKey` names the object left in the bucket when even the rollback
 * delete failed, which is the only state a caller cannot reconstruct from the
 * row. It is `null` on every other upload failure.
 */
export class AvatarUploadFailed extends Schema.TaggedError<AvatarUploadFailed>()(
  "AvatarUploadFailed",
  { orphanedKey: Schema.NullOr(Schema.String) }
) {}

export interface AvatarUpdated {
  readonly avatarUrl: string;
  readonly cleanup: "complete" | "pending";
}

/**
 * The value the read produced, or null once the cause has been written to
 * Workers Logs under `event`.
 *
 * Every failure on the avatar path collapses into one user-facing result, so a
 * failed read and an absent row reach the caller the same way. That includes a
 * missing D1 or R2 binding, which surfaces as an upload failure rather than
 * propagating.
 */
const orNull = <A>(
  event: string,
  effect: Effect.Effect<A, UserPersistenceError>
): Effect.Effect<A | null> =>
  effect.pipe(
    Effect.catchTags({
      UserPersistenceError: (error) =>
        Effect.sync(() => {
          reportError(event, error.cause);
          return null;
        }),
    })
  );

/**
 * Whether the write succeeded, once a failure's cause has been written to
 * Workers Logs under `event`. A failure is the caller's branch rather than an
 * error, because the avatar path reports a failed delete as a distinct result.
 */
const succeeded = (
  event: string,
  effect: Effect.Effect<unknown, UserPersistenceError>
): Effect.Effect<boolean> =>
  effect.pipe(
    Effect.as(true),
    Effect.catchTags({
      UserPersistenceError: (error) =>
        Effect.sync(() => {
          reportError(event, error.cause);
          return false;
        }),
    })
  );

export class UserGateway extends Context.Service<
  UserGateway,
  {
    readonly fetchCurrentUser: (
      userId: string,
      email: string
    ) => Effect.Effect<UserWithEmail | null, UserPersistenceError>;
    readonly updateUser: (
      userId: string,
      data: UpdateUser
    ) => Effect.Effect<void, UserNameUpdateFailed>;
    readonly updateUserAvatar: (
      userId: string,
      file: File
    ) => Effect.Effect<
      AvatarUpdated,
      AvatarTypeUnsupported | AvatarUploadFailed
    >;
  }
>()("app/gateways/user/UserGateway") {
  static readonly layerNoDeps = Layer.effect(
    UserGateway,
    Effect.gen(function* buildUserGateway() {
      const keyIds = yield* AvatarKeyIds;
      const storage = yield* AvatarStorage;
      const store = yield* UserStore;

      const fetchCurrentUser = Effect.fn("UserGateway.fetchCurrentUser")(
        function* fetchCurrentUser(userId: string, email: string) {
          const profile = yield* store.findProfile(userId);
          if (profile === null) {
            return null;
          }
          return encodeUserWithEmail({
            avatarUrl:
              profile.avatarKey === null
                ? profile.image
                : avatarUrlForKey(profile.avatarKey),
            createdAt: profile.createdAt,
            email,
            id: profile.id,
            name: profile.name,
            updatedAt: profile.updatedAt,
          });
        }
      );

      const updateUser = Effect.fn("UserGateway.updateUser")(
        function* updateUser(userId: string, data: UpdateUser) {
          const updatedAt = yield* DateTime.now;
          const written = yield* succeeded(
            "user.updateName",
            store.updateName(userId, data.name, updatedAt)
          );
          return yield* written
            ? Effect.void
            : Effect.fail(new UserNameUpdateFailed());
        }
      );

      // The previous avatar is removed only after `setAvatarUrl` has reported
      // one touched row, so a failure between the two leaves an unreferenced
      // object rather than a row referencing a deleted one.
      const updateUserAvatar = Effect.fn("UserGateway.updateUserAvatar")(
        function* updateUserAvatar(userId: string, file: File) {
          const fileExt = avatarExtensionForMime(file.type);
          if (fileExt === null) {
            return yield* new AvatarTypeUnsupported();
          }
          const contentMatches = yield* Effect.promise(
            async () => await avatarContentMatchesMime(file)
          );
          if (!contentMatches) {
            return yield* new AvatarTypeUnsupported();
          }

          const current = yield* orNull(
            "user.findAvatarKey",
            store.findAvatarKey(userId)
          );
          if (current === null) {
            return yield* new AvatarUploadFailed({ orphanedKey: null });
          }

          const previousKey = current.avatarKey;
          const keyId = yield* keyIds.next;
          const key = `${userId}/avatars/${keyId}.${fileExt}`;

          const uploaded = yield* succeeded(
            "user.upload",
            storage.upload(key, file, file.type)
          );
          if (!uploaded) {
            return yield* new AvatarUploadFailed({ orphanedKey: null });
          }
          const publicUrl = avatarUrlForKey(key);

          const updatedAt = yield* DateTime.now;
          const rowsTouched = yield* orNull(
            "user.setAvatarKey",
            store.setAvatarKey(userId, key, updatedAt)
          );
          if (rowsTouched !== 1) {
            if (rowsTouched !== null) {
              yield* Effect.sync(() => {
                reportError(
                  "user.setAvatarKey",
                  new UnexpectedRowCount({
                    message: `expected 1 row, got ${String(rowsTouched)}`,
                    rowsTouched,
                  })
                );
              });
            }
            const rolledBack = yield* succeeded(
              "user.rollbackUpload",
              storage.remove(key)
            );
            return yield* new AvatarUploadFailed({
              orphanedKey: rolledBack ? null : key,
            });
          }

          if (previousKey === null) {
            return { avatarUrl: publicUrl, cleanup: "complete" } as const;
          }
          const removedPrevious = yield* succeeded(
            "user.removePrevious",
            storage.remove(previousKey)
          );
          return {
            avatarUrl: publicUrl,
            cleanup: removedPrevious ? "complete" : "pending",
          } as const;
        }
      );

      return UserGateway.of({ fetchCurrentUser, updateUser, updateUserAvatar });
    })
  );

  static readonly layer = UserGateway.layerNoDeps.pipe(
    Layer.provide(AvatarKeyIds.layer),
    Layer.provide(AvatarStorage.layer),
    Layer.provide(UserStore.layer)
  );
}
