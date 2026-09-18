import { DateTime, Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import type { UpdateUser, UserWithEmail } from "@/entities/user";
import type { ErrorLogRecord } from "@/lib/report-error";
import { ABSENT_FIELD } from "@/test/absent-field";
import { DriverFailed } from "@/test/defect";
import { UserPersistenceError } from ".";
import {
  AvatarTypeUnsupported,
  AvatarUploadFailed,
  AvatarWriter,
} from "./avatar/update";
import { CurrentUserReader } from "./read";
import {
  ProfileWriter,
  UserNames,
  updateProfileResult,
  uploadAvatarResult,
} from "./update";

const TEST_CLOCK_INSTANT = "1970-01-01T00:00:00.000Z";

// similarity-ignore: avatar/update.test.ts の同名ヘルパーと同じ形だが、`vi` は
// テストファイルの外から import できない（vitest/no-importing-vitest-globals）ので、
// 共有モジュールに出せない。
type CapturedReport = Pick<ErrorLogRecord, "event" | "message" | "name">;

const captureErrorReports = (): CapturedReport[] => {
  const reported: CapturedReport[] = [];
  vi.spyOn(console, "error").mockImplementation((payload: ErrorLogRecord) => {
    reported.push({
      event: payload.event,
      message: payload.message,
      name: payload.name,
    });
  });
  return reported;
};

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
      Effect.runPromise(
        updateProfileResult(data).pipe(
          Effect.provide(layer),
          Effect.provide(TestClock.layer())
        )
      ),
    uploadAvatar: (file: File) =>
      Effect.runPromise(
        uploadAvatarResult(file).pipe(
          Effect.provide(layer),
          Effect.provide(TestClock.layer())
        )
      ),
  };
};

describe(updateProfileResult, () => {
  it("should reject without writing persistence when the request is anonymous", () => {
    const { setName, updateProfile } = makeFakes(Effect.succeed(Option.none()));

    return updateProfile({ name: "Updated User" }).then((result) => {
      expect({ result, updateCalls: setName.mock.calls }).toStrictEqual({
        result: { message: "Not authenticated", status: "failed" },
        updateCalls: [],
      });
    });
  });

  it("should pass the server-derived identity when the request is authenticated", () => {
    const { setName, updateProfile } = makeFakes(
      Effect.succeed(Option.some(authenticatedUser))
    );
    const data = { name: "Updated User" };

    return updateProfile(data).then((result) => {
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
    });
  });

  it("should report the write failure when the name update fails", () => {
    const { setName, updateProfile } = makeFakes(
      Effect.succeed(Option.some(authenticatedUser))
    );
    setName.mockReturnValue(
      Effect.fail(
        new UserPersistenceError({
          cause: new DriverFailed({ message: "D1 failed" }),
        })
      )
    );
    const reported = captureErrorReports();

    return updateProfile({ name: "Updated User" }).then((result) => {
      expect({ reported, result }).toStrictEqual({
        reported: [
          {
            event: "user.updateName",
            message: "D1 failed",
            name: "DriverFailed",
          },
        ],
        result: {
          message: "Failed to update profile",
          status: "failed",
        },
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
    const { replaceAvatar, uploadAvatar } = makeFakes(
      Effect.succeed(Option.none())
    );

    return uploadAvatar(pngFile(1)).then((result) => {
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
    });
  });

  it("should pass the server-derived identity when the request is authenticated", () => {
    const { replaceAvatar, uploadAvatar } = makeFakes(
      Effect.succeed(Option.some(authenticatedUser))
    );
    const file = pngFile(1);

    return uploadAvatar(file).then((result) => {
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
    });
  });

  it("should report the rejected type when the gateway refuses the image", () => {
    const { replaceAvatar, uploadAvatar } = makeFakes(
      Effect.succeed(Option.some(authenticatedUser))
    );
    replaceAvatar.mockReturnValue(Effect.fail(new AvatarTypeUnsupported()));

    return uploadAvatar(pngFile(1)).then((result) => {
      expect(result).toStrictEqual({
        message: "Unsupported image type",
        status: "failed",
      });
    });
  });

  it("should report a failed upload when the gateway could not store the object", () => {
    const { replaceAvatar, uploadAvatar } = makeFakes(
      Effect.succeed(Option.some(authenticatedUser))
    );
    replaceAvatar.mockReturnValue(Effect.fail(new AvatarUploadFailed()));

    return uploadAvatar(pngFile(1)).then((result) => {
      expect(result).toStrictEqual({
        message: "Failed to upload avatar",
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
