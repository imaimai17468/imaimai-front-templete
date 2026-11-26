import { describe, expect, it, vi } from "@effect/vitest";
import { DateTime, Effect, Layer, Option } from "effect";
import type { UpdateUser, UserWithEmail } from "@/shared/entities/user/user";
import { capturedReports } from "@/shared/gateway/error-reports";
import { defectsToLog } from "@/shared/gateway/runtime";
import { ABSENT_FIELD } from "@/test/absent-field";
import { DriverFailed } from "@/test/defect";
import {
  AvatarTypeUnsupported,
  AvatarUploadFailed,
  AvatarWriter,
} from "./avatar/update.ts";
import { UserPersistenceError } from "./persistence.ts";
import { CurrentUserReader } from "./read.ts";
import {
  ProfileWriter,
  UserNames,
  updateProfileResult,
  uploadAvatarResult,
} from "./update.ts";

const TEST_CLOCK_INSTANT = "1970-01-01T00:00:00.000Z";

const pngFile = (byteLength: number) =>
  new File([new Uint8Array(byteLength)], "a.png", { type: "image/png" });

const authenticatedUser = {
  avatarUrl: ABSENT_FIELD,
  createdAt: "2026-08-13T00:00:00Z",
  email: "user-1@example.com",
  id: "user-1",
  name: "Test User",
  updatedAt: "2026-08-13T00:00:00Z",
} satisfies UserWithEmail;

const makeFakes = (read: CurrentUserReader["Service"]["read"]) => {
  const setName = vi.fn<UserNames["Service"]["set"]>();
  const replaceAvatar = vi.fn<AvatarWriter["Service"]["replace"]>();

  setName.mockReturnValue(Effect.succeed(1));
  replaceAvatar.mockReturnValue(
    Effect.succeed({ avatarUrl: "/api/avatars?key=new", cleanup: "complete" })
  );

  const layer = ProfileWriter.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          AvatarWriter,
          AvatarWriter.of({ replace: replaceAvatar })
        ),
        Layer.succeed(CurrentUserReader, CurrentUserReader.of({ read })),
        Layer.succeed(UserNames, UserNames.of({ set: setName }))
      )
    )
  );

  return {
    replaceAvatar,
    setName,
    updateProfile: (data: UpdateUser) =>
      updateProfileResult(data).pipe(Effect.provide(layer)),
    uploadAvatar: (file: File) =>
      uploadAvatarResult(file).pipe(Effect.provide(layer)),
  };
};

describe(updateProfileResult, () => {
  it.effect(
    "should reject without writing persistence when the request is anonymous",
    () =>
      Effect.gen(function* () {
        const { setName, updateProfile } = makeFakes(Effect.succeedNone);

        const result = yield* updateProfile({ name: "Updated User" });

        expect({ result, updateCalls: setName.mock.calls }).toStrictEqual({
          result: { message: "Not authenticated", status: "failed" },
          updateCalls: [],
        });
      })
  );

  it.effect(
    "should pass the server-derived identity when the request is authenticated",
    () =>
      Effect.gen(function* () {
        const { setName, updateProfile } = makeFakes(
          Effect.succeedSome(authenticatedUser)
        );

        const result = yield* updateProfile({ name: "Updated User" });

        expect({ result, updateCalls: setName.mock.calls }).toStrictEqual({
          result: { status: "updated" },
          updateCalls: [
            [
              "user-1",
              Option.some("Updated User"),
              DateTime.makeUnsafe(TEST_CLOCK_INSTANT),
            ],
          ],
        });
      })
  );

  it.effect("should report the write failure when the name update fails", () =>
    Effect.gen(function* () {
      const { setName, updateProfile } = makeFakes(
        Effect.succeedSome(authenticatedUser)
      );
      setName.mockReturnValue(
        Effect.fail(
          UserPersistenceError.make({
            cause: DriverFailed.make({ message: "D1 failed" }),
          })
        )
      );

      const result = yield* updateProfile({ name: "Updated User" });
      const reported = yield* capturedReports;

      expect({ reported, result }).toStrictEqual({
        reported: [
          {
            event: "user.updateName",
            message: "D1 failed",
            name: "DriverFailed",
            operations: [
              "updateProfileResult",
              "ProfileWriter.updateProfile",
              "wroteOneRow",
            ],
          },
        ],
        result: {
          message: "Failed to update profile",
          status: "failed",
        },
      });
    })
  );

  it.effect(
    "should report the write failure when the name update touches zero rows",
    () =>
      Effect.gen(function* () {
        const { setName, updateProfile } = makeFakes(
          Effect.succeedSome(authenticatedUser)
        );
        setName.mockReturnValue(Effect.succeed(0));

        const result = yield* updateProfile({ name: "Updated User" });
        const reported = yield* capturedReports;

        expect({ reported, result }).toStrictEqual({
          reported: [
            {
              event: "user.updateName",
              message: "expected 1 row, got 0",
              name: "UnexpectedRowCount",
              operations: [
                "updateProfileResult",
                "ProfileWriter.updateProfile",
                "wroteOneRow",
              ],
            },
          ],
          result: {
            message: "Failed to update profile",
            status: "failed",
          },
        });
      })
  );

  it.effect(
    "should propagate the cause as a defect when the identity read fails",
    () =>
      Effect.gen(function* () {
        const driverFailure = DriverFailed.make({ message: "D1 failed" });
        const { updateProfile } = makeFakes(
          Effect.fail(UserPersistenceError.make({ cause: driverFailure }))
        );

        const cause = yield* updateProfile({ name: "Updated User" }).pipe(
          Effect.sandbox,
          Effect.flip
        );

        expect(defectsToLog(cause)).toStrictEqual([
          {
            defect: driverFailure,
            operations: ["updateProfileResult"],
          },
        ]);
      })
  );
});

describe(uploadAvatarResult, () => {
  it.effect(
    "should reject without writing persistence when the request is anonymous",
    () =>
      Effect.gen(function* () {
        const { replaceAvatar, uploadAvatar } = makeFakes(Effect.succeedNone);

        const result = yield* uploadAvatar(pngFile(1));

        expect({
          result,
          updateCalls: replaceAvatar.mock.calls,
        }).toStrictEqual({
          result: {
            message: "Not authenticated",
            status: "failed",
          },
          updateCalls: [],
        });
      })
  );

  it.effect(
    "should pass the server-derived identity when the request is authenticated",
    () =>
      Effect.gen(function* () {
        const { replaceAvatar, uploadAvatar } = makeFakes(
          Effect.succeedSome(authenticatedUser)
        );
        const file = pngFile(1);

        const result = yield* uploadAvatar(file);

        expect({
          result,
          updateCalls: replaceAvatar.mock.calls,
        }).toStrictEqual({
          result: {
            avatarUrl: "/api/avatars?key=new",
            cleanup: "complete",
            status: "uploaded",
          },
          updateCalls: [["user-1", file]],
        });
      })
  );

  it.effect(
    "should report the rejected type when the gateway refuses the image",
    () =>
      Effect.gen(function* () {
        const { replaceAvatar, uploadAvatar } = makeFakes(
          Effect.succeedSome(authenticatedUser)
        );
        replaceAvatar.mockReturnValue(
          Effect.fail(AvatarTypeUnsupported.make())
        );

        const result = yield* uploadAvatar(pngFile(1));

        expect(result).toStrictEqual({
          message: "Unsupported image type",
          status: "failed",
        });
      })
  );

  it.effect(
    "should report a failed upload when the gateway could not store the object",
    () =>
      Effect.gen(function* () {
        const { replaceAvatar, uploadAvatar } = makeFakes(
          Effect.succeedSome(authenticatedUser)
        );
        replaceAvatar.mockReturnValue(Effect.fail(AvatarUploadFailed.make()));

        const result = yield* uploadAvatar(pngFile(1));

        expect(result).toStrictEqual({
          message: "Failed to upload avatar",
          status: "failed",
        });
      })
  );

  it.effect(
    "should name the upload operations the defect was raised inside when the avatar writer dies",
    () =>
      Effect.gen(function* () {
        const writerFailure = DriverFailed.make({ message: "R2 failed" });
        const { replaceAvatar, uploadAvatar } = makeFakes(
          Effect.succeedSome(authenticatedUser)
        );
        replaceAvatar.mockReturnValue(Effect.die(writerFailure));

        const cause = yield* uploadAvatar(pngFile(1)).pipe(
          Effect.sandbox,
          Effect.flip
        );

        expect(defectsToLog(cause)).toStrictEqual([
          {
            defect: writerFailure,
            operations: ["uploadAvatarResult", "ProfileWriter.uploadAvatar"],
          },
        ]);
      })
  );

  it.effect(
    "should propagate the cause as a defect when the identity read fails",
    () =>
      Effect.gen(function* () {
        const driverFailure = DriverFailed.make({ message: "D1 failed" });
        const { uploadAvatar } = makeFakes(
          Effect.fail(UserPersistenceError.make({ cause: driverFailure }))
        );

        const cause = yield* uploadAvatar(pngFile(1)).pipe(
          Effect.sandbox,
          Effect.flip
        );

        expect(defectsToLog(cause)).toStrictEqual([
          {
            defect: driverFailure,
            operations: ["uploadAvatarResult"],
          },
        ]);
      })
  );
});
