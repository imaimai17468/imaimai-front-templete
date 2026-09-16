import { Context, Effect, Layer, Schema } from "effect";
import type { UpdateUser } from "@/entities/user";
import { UserGateway } from ".";
import type {
  AvatarTypeUnsupported,
  AvatarUpdated,
  AvatarUploadFailed,
  UserNameUpdateFailed,
  UserPersistenceError,
} from ".";
import { makeRunHandler } from "../runtime.live";
import { CurrentUserReader } from "./current-user";

export class NotAuthenticated extends Schema.TaggedError<NotAuthenticated>()(
  "NotAuthenticated",
  {}
) {}

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
      const gateway = yield* UserGateway;

      const requireUser = Effect.gen(function* requireUser() {
        const user = yield* reader.read;
        if (user === null) {
          return yield* new NotAuthenticated();
        }
        return user;
      });

      const updateProfile = Effect.fn("ProfileWriter.updateProfile")(
        function* updateProfile(data: UpdateUser) {
          const user = yield* requireUser;
          return yield* gateway.updateUser(user.id, data);
        }
      );

      const uploadAvatar = Effect.fn("ProfileWriter.uploadAvatar")(
        function* uploadAvatar(file: File) {
          const user = yield* requireUser;
          return yield* gateway.updateUserAvatar(user.id, file);
        }
      );

      return ProfileWriter.of({ updateProfile, uploadAvatar });
    })
  );

  static readonly layer = ProfileWriter.layerNoDeps.pipe(
    Layer.provide(CurrentUserReader.layer),
    Layer.provide(UserGateway.layer)
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
 * and only the previous object is still in the bucket. `orphanedKey` rides the
 * failure arm, where the row still points at the previous avatar.
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
      readonly orphanedKey: string | null;
    };

export const updateProfileResult: (
  data: UpdateUser
) => Effect.Effect<UpdateProfileResult, never, ProfileWriter> = Effect.fn(
  "updateProfileResult"
)(
  function* writeProfile(data: UpdateUser) {
    const writer = yield* ProfileWriter;
    yield* writer.updateProfile(data);
    return { status: "updated" } as const;
  },
  Effect.catchTags({
    NotAuthenticated: () =>
      Effect.succeed({
        message: "Not authenticated",
        status: "failed",
      } as const),
    UserNameUpdateFailed: () =>
      Effect.succeed({
        message: "Failed to update profile",
        status: "failed",
      } as const),
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
    } as const;
  },
  Effect.catchTags({
    AvatarTypeUnsupported: () =>
      Effect.succeed({
        message: "Unsupported image type",
        orphanedKey: null,
        status: "failed",
      } as const),
    AvatarUploadFailed: (error) =>
      Effect.succeed({
        message: "Failed to upload avatar",
        orphanedKey: error.orphanedKey,
        status: "failed",
      } as const),
    NotAuthenticated: () =>
      Effect.succeed({
        message: "Not authenticated",
        orphanedKey: null,
        status: "failed",
      } as const),
    UserPersistenceError: (error) => Effect.die(error.cause),
  })
);

const runProfileHandler = makeRunHandler(ProfileWriter.layer);

/** Writes the caller's name onto their own profile row. */
export const runUpdateProfile = async (
  data: UpdateUser
): Promise<UpdateProfileResult> =>
  await runProfileHandler(updateProfileResult(data));

export const runUploadAvatar = async (
  file: File
): Promise<UploadAvatarResult> =>
  await runProfileHandler(uploadAvatarResult(file));
