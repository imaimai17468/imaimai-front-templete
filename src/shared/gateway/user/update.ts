import "@tanstack/react-start/server-only";
import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";
import type { UpdateUser } from "@/shared/entities/user/user";
import { makeRunHandler } from "../runtime.ts";
import { AvatarWriter } from "./avatar/update.ts";
import type {
  AvatarTypeUnsupported,
  AvatarUpdated,
  AvatarUploadFailed,
} from "./avatar/update.ts";
import {
  dieOnPersistenceError,
  writeUserRow,
  wroteOneRow,
} from "./persistence.ts";
import type { UserPersistenceError } from "./persistence.ts";
import { CurrentUserReader } from "./read.ts";

class NotAuthenticated extends Schema.TaggedError<
  NotAuthenticated,
  { readonly brand: unique symbol }
>()("NotAuthenticated", {}) {}

class UserNameUpdateFailed extends Schema.TaggedError<
  UserNameUpdateFailed,
  { readonly brand: unique symbol }
>()("UserNameUpdateFailed", {}) {}

/**
 * The `name` column of a user's own row.
 *
 * A service rather than a direct query so a test drives the failure arm
 * without a D1 binding.
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
>()("my-app/shared/gateway/user/update/UserNames") {
  static readonly layer = Layer.succeed(
    UserNames,
    UserNames.of({
      set: (userId, name, updatedAt) =>
        writeUserRow(userId, { name: Option.getOrNull(name) }, updatedAt),
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
>()("my-app/shared/gateway/user/update/ProfileWriter") {
  static readonly layerNoDeps = Layer.effect(
    ProfileWriter,
    Effect.gen(function* () {
      const reader = yield* CurrentUserReader;
      const names = yield* UserNames;
      const avatars = yield* AvatarWriter;

      const requireUser = Effect.gen(function* () {
        const user = yield* reader.read;
        if (Option.isNone(user)) {
          return yield* NotAuthenticated.make();
        }
        return user.value;
      });

      const updateProfile = Effect.fn("ProfileWriter.updateProfile")(function* (
        data: UpdateUser
      ) {
        const user = yield* requireUser;
        const updatedAt = yield* DateTime.now;
        const wrote = yield* wroteOneRow(
          "user.updateName",
          names.set(user.id, Option.some(data.name), updatedAt)
        );
        if (!wrote) {
          return yield* UserNameUpdateFailed.make();
        }
        return yield* Effect.void;
      });

      const uploadAvatar = Effect.fn("ProfileWriter.uploadAvatar")(function* (
        file: File
      ) {
        const user = yield* requireUser;
        return yield* avatars.replace(user.id, file);
      });

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
  function* (data: UpdateUser) {
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
    ...dieOnPersistenceError,
  })
);

export const uploadAvatarResult: (
  file: File
) => Effect.Effect<UploadAvatarResult, never, ProfileWriter> = Effect.fn(
  "uploadAvatarResult"
)(
  function* (file: File) {
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
    ...dieOnPersistenceError,
  })
);

const runProfileHandler = makeRunHandler(ProfileWriter.layer);

/**
 * Writes the caller's name onto their own profile row. It takes the handler
 * context `updateProfileFn` passes, so the server function hands it over as is.
 */
export const updateProfile = ({
  data,
}: {
  readonly data: UpdateUser;
}): Promise<UpdateProfileResult> =>
  runProfileHandler(updateProfileResult(data));

/**
 * Replaces the caller's avatar. It takes the handler context `uploadAvatarFn`
 * passes, so the server function hands it over as is.
 */
export const uploadAvatar = ({
  data,
}: {
  readonly data: { readonly avatar: File };
}): Promise<UploadAvatarResult> =>
  runProfileHandler(uploadAvatarResult(data.avatar));
