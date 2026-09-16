import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import type { UpdateUser, UserWithEmail } from "@/entities/user";
import { DriverFailed } from "@/test/defect";
import {
  AvatarTypeUnsupported,
  AvatarUploadFailed,
  UserGateway,
  UserNameUpdateFailed,
  UserPersistenceError,
} from ".";
import { CurrentUserReader } from "./current-user";
import {
  ProfileWriter,
  updateProfileResult,
  uploadAvatarResult,
} from "./profile-writer";

const pngFile = (byteLength: number) =>
  new File([new Uint8Array(byteLength)], "a.png", { type: "image/png" });

const authenticatedUser = {
  avatarUrl: null,
  createdAt: "2026-08-13T00:00:00Z",
  email: "user-1@example.com",
  id: "user-1",
  name: "Test User",
  updatedAt: "2026-08-13T00:00:00Z",
} satisfies UserWithEmail;

const makeFakes = (read: CurrentUserReader["Service"]["read"]) => {
  const updateUser = vi.fn<UserGateway["Service"]["updateUser"]>();
  const updateUserAvatar = vi.fn<UserGateway["Service"]["updateUserAvatar"]>();

  updateUser.mockReturnValue(Effect.void);
  updateUserAvatar.mockReturnValue(
    Effect.succeed({ avatarUrl: "/api/avatars?key=new", cleanup: "complete" })
  );

  const layer = ProfileWriter.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(CurrentUserReader, CurrentUserReader.of({ read })),
        Layer.succeed(
          UserGateway,
          UserGateway.of({
            fetchCurrentUser:
              vi.fn<UserGateway["Service"]["fetchCurrentUser"]>(),
            updateUser,
            updateUserAvatar,
          })
        )
      )
    )
  );

  return {
    updateProfile: (data: UpdateUser) =>
      Effect.runPromise(updateProfileResult(data).pipe(Effect.provide(layer))),
    updateUser,
    updateUserAvatar,
    uploadAvatar: (file: File) =>
      Effect.runPromise(uploadAvatarResult(file).pipe(Effect.provide(layer))),
  };
};

describe(updateProfileResult, () => {
  it("should reject without writing persistence when the request is anonymous", () => {
    const { updateProfile, updateUser } = makeFakes(Effect.succeed(null));

    return updateProfile({ name: "Updated User" }).then((result) => {
      expect({ result, updateCalls: updateUser.mock.calls }).toStrictEqual({
        result: { message: "Not authenticated", status: "failed" },
        updateCalls: [],
      });
    });
  });

  it("should pass the server-derived identity when the request is authenticated", () => {
    const { updateProfile, updateUser } = makeFakes(
      Effect.succeed(authenticatedUser)
    );
    const data = { name: "Updated User" };

    return updateProfile(data).then((result) => {
      expect({ result, updateCalls: updateUser.mock.calls }).toStrictEqual({
        result: { status: "updated" },
        updateCalls: [["user-1", data]],
      });
    });
  });

  it("should report the write failure when the name update fails", () => {
    const { updateProfile, updateUser } = makeFakes(
      Effect.succeed(authenticatedUser)
    );
    updateUser.mockReturnValue(Effect.fail(new UserNameUpdateFailed()));

    return updateProfile({ name: "Updated User" }).then((result) => {
      expect(result).toStrictEqual({
        message: "Failed to update profile",
        status: "failed",
      });
    });
  });

  it("should propagate the cause as a defect when the identity read fails", () => {
    const { updateProfile } = makeFakes(
      Effect.fail(
        new UserPersistenceError({
          cause: new DriverFailed({ message: "D1 failed" }),
        })
      )
    );

    const result = updateProfile({ name: "Updated User" });

    return expect(result).rejects.toThrow("D1 failed");
  });
});

describe(uploadAvatarResult, () => {
  it("should reject without writing persistence when the request is anonymous", () => {
    const { updateUserAvatar, uploadAvatar } = makeFakes(Effect.succeed(null));

    return uploadAvatar(pngFile(1)).then((result) => {
      expect({
        result,
        updateCalls: updateUserAvatar.mock.calls,
      }).toStrictEqual({
        result: {
          message: "Not authenticated",
          orphanedKey: null,
          status: "failed",
        },
        updateCalls: [],
      });
    });
  });

  it("should pass the server-derived identity when the request is authenticated", () => {
    const { updateUserAvatar, uploadAvatar } = makeFakes(
      Effect.succeed(authenticatedUser)
    );
    const file = pngFile(1);

    return uploadAvatar(file).then((result) => {
      expect({
        result,
        updateCalls: updateUserAvatar.mock.calls,
      }).toStrictEqual({
        result: {
          avatarUrl: "/api/avatars?key=new",
          cleanup: "complete",
          status: "uploaded",
        },
        updateCalls: [["user-1", file]],
      });
    });
  });

  it("should report the rejected type when the gateway refuses the image", () => {
    const { updateUserAvatar, uploadAvatar } = makeFakes(
      Effect.succeed(authenticatedUser)
    );
    updateUserAvatar.mockReturnValue(Effect.fail(new AvatarTypeUnsupported()));

    return uploadAvatar(pngFile(1)).then((result) => {
      expect(result).toStrictEqual({
        message: "Unsupported image type",
        orphanedKey: null,
        status: "failed",
      });
    });
  });

  it("should carry the orphaned key when the gateway leaves an object behind", () => {
    const { updateUserAvatar, uploadAvatar } = makeFakes(
      Effect.succeed(authenticatedUser)
    );
    updateUserAvatar.mockReturnValue(
      Effect.fail(
        new AvatarUploadFailed({ orphanedKey: "user-1/avatars/a.png" })
      )
    );

    return uploadAvatar(pngFile(1)).then((result) => {
      expect(result).toStrictEqual({
        message: "Failed to upload avatar",
        orphanedKey: "user-1/avatars/a.png",
        status: "failed",
      });
    });
  });

  it("should propagate the cause as a defect when the identity read fails", () => {
    const { uploadAvatar } = makeFakes(
      Effect.fail(
        new UserPersistenceError({
          cause: new DriverFailed({ message: "D1 failed" }),
        })
      )
    );

    const result = uploadAvatar(pngFile(1));

    return expect(result).rejects.toThrow("D1 failed");
  });
});
