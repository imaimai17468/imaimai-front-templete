import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";
import { getDb } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import { reportError } from "@/lib/report-error";
import type { UpdateUser } from "@/shared/entities/user";
import { orNone, persistenceEffect, UnexpectedRowCount } from ".";
import type { UserPersistenceError } from ".";
import { makeRunHandler } from "../runtime";
import { AvatarWriter } from "./avatar/update";
import type {
  AvatarTypeUnsupported,
  AvatarUpdated,
  AvatarUploadFailed,
} from "./avatar/update";
import { CurrentUserReader } from "./read";

class NotAuthenticated extends Schema.TaggedError<NotAuthenticated>()(
  "NotAuthenticated",
  {}
) {}

class UserNameUpdateFailed extends Schema.TaggedError<UserNameUpdateFailed>()(
  "UserNameUpdateFailed",
  {}
) {}

/**
 * The `name` column of a user's own row.
 *
 * A service rather than a direct query so a test drives the failure arm
 * without a D1 binding. `set` reports the number of rows it touched, so the
 * caller can reject a write that addressed nobody, the way the avatar path
 * already does.
 */
export class UserNames extends Context.Service<
  UserNames,
  {
    readonly set: (
      userId: string,
      name: Option.Option<string>,
      updatedAt: DateTime.Utc
    ) => Effect.Effect<number, UserPersistenceError>;
  }
>()("app/gateways/user/UserNames") {
  static readonly layer = Layer.succeed(
    UserNames,
    UserNames.of({
      set: (userId, name, updatedAt) =>
        persistenceEffect(() =>
          getDb()
            .update(users)
            .set({
              name: Option.getOrNull(name),
              updatedAt: DateTime.toDateUtc(updatedAt),
            })
            .where(eq(users.id, userId))
            .returning({ id: users.id })
            .then((rows) => rows.length)
        ),
    })
  );
}

/**
 * The authorization boundary between a caller and the writes on their own
 * profile row.
 *
 * Its dependencies are services rather than arguments, so a test provides a
 * layer instead of a session cookie, a D1 binding and an R2 binding, and so
 * the check itself stays the only thing under test.
 */
export class ProfileWriter extends Context.Service<
  ProfileWriter,
  {
    readonly updateProfile: (
      data: UpdateUser
    ) => Effect.Effect<
      void,
      NotAuthenticated | UserNameUpdateFailed | UserPersistenceError
    >;
    readonly uploadAvatar: (
      file: File
    ) => Effect.Effect<
      AvatarUpdated,
      | AvatarTypeUnsupported
      | AvatarUploadFailed
      | NotAuthenticated
      | UserPersistenceError
    >;
  }
>()("app/gateways/user/ProfileWriter") {
  static readonly layerNoDeps = Layer.effect(
    ProfileWriter,
    Effect.gen(function* buildProfileWriter() {
      const reader = yield* CurrentUserReader;
      const names = yield* UserNames;
      const avatars = yield* AvatarWriter;

      const requireUser = Effect.gen(function* requireUser() {
        const user = yield* reader.read;
        if (Option.isNone(user)) {
          return yield* new NotAuthenticated();
        }
        return user.value;
      });

      const updateProfile = Effect.fn("ProfileWriter.updateProfile")(
        function* updateProfile(data: UpdateUser) {
          const user = yield* requireUser;
          const updatedAt = yield* DateTime.now;
          const rowsTouched = yield* orNone(
            "user.updateName",
            names.set(user.id, Option.some(data.name), updatedAt)
          );
          if (!Option.contains(rowsTouched, 1)) {
            if (Option.isSome(rowsTouched)) {
              yield* reportError(
                "user.updateName",
                new UnexpectedRowCount({
                  message: `expected 1 row, got ${String(rowsTouched.value)}`,
                })
              );
            }
            return yield* new UserNameUpdateFailed();
          }
          return yield* Effect.void;
        }
      );

      const uploadAvatar = Effect.fn("ProfileWriter.uploadAvatar")(
        function* uploadAvatar(file: File) {
          const user = yield* requireUser;
          return yield* avatars.replace(user.id, file);
        }
      );

      return ProfileWriter.of({ updateProfile, uploadAvatar });
    })
  );

  static readonly layer = ProfileWriter.layerNoDeps.pipe(
    Layer.provide(AvatarWriter.layer),
    Layer.provide(CurrentUserReader.layer),
    Layer.provide(UserNames.layer)
  );
}

/**
 * What `updateProfileFn` answers with.
 *
 * A tagged error class does not survive the network boundary, so each failure
 * becomes an arm of this union. `status` discriminates it, which is what keeps
 * a message-carrying arm from also claiming the write landed.
 */
export type UpdateProfileResult =
  | { readonly status: "updated" }
  | { readonly status: "failed"; readonly message: string };

/**
 * What `uploadAvatarFn` answers with.
 *
 * `cleanup: "pending"` rides the success arm: the row points at the new avatar
 * and only the previous object is still in the bucket. The failure arm leaves
 * the row pointing at the previous avatar.
 */
export type UploadAvatarResult =
  | {
      readonly status: "uploaded";
      readonly avatarUrl: string;
      readonly cleanup: "complete" | "pending";
    }
  | {
      readonly status: "failed";
      readonly message: string;
    };

export const updateProfileResult: (
  data: UpdateUser
) => Effect.Effect<UpdateProfileResult, never, ProfileWriter> = Effect.fn(
  "updateProfileResult"
)(
  function* writeProfile(data: UpdateUser) {
    const writer = yield* ProfileWriter;
    yield* writer.updateProfile(data);
    return { status: "updated" } satisfies UpdateProfileResult;
  },
  Effect.catchTags({
    NotAuthenticated: () =>
      Effect.succeed({
        message: "Not authenticated",
        status: "failed",
      } satisfies UpdateProfileResult),
    UserNameUpdateFailed: () =>
      Effect.succeed({
        message: "Failed to update profile",
        status: "failed",
      } satisfies UpdateProfileResult),
    UserPersistenceError: (error) => Effect.die(error.cause),
  })
);

export const uploadAvatarResult: (
  file: File
) => Effect.Effect<UploadAvatarResult, never, ProfileWriter> = Effect.fn(
  "uploadAvatarResult"
)(
  function* writeAvatar(file: File) {
    const writer = yield* ProfileWriter;
    const updated = yield* writer.uploadAvatar(file);
    return {
      avatarUrl: updated.avatarUrl,
      cleanup: updated.cleanup,
      status: "uploaded",
    } satisfies UploadAvatarResult;
  },
  Effect.catchTags({
    AvatarTypeUnsupported: () =>
      Effect.succeed({
        message: "Unsupported image type",
        status: "failed",
      } satisfies UploadAvatarResult),
    AvatarUploadFailed: () =>
      Effect.succeed({
        message: "Failed to upload avatar",
        status: "failed",
      } satisfies UploadAvatarResult),
    NotAuthenticated: () =>
      Effect.succeed({
        message: "Not authenticated",
        status: "failed",
      } satisfies UploadAvatarResult),
    UserPersistenceError: (error) => Effect.die(error.cause),
  })
);

const runProfileHandler = makeRunHandler(ProfileWriter.layer);

/** Writes the caller's name onto their own profile row. */
export const updateProfile = (data: UpdateUser): Promise<UpdateProfileResult> =>
  runProfileHandler(updateProfileResult(data));

export const uploadAvatar = (file: File): Promise<UploadAvatarResult> =>
  runProfileHandler(uploadAvatarResult(file));
