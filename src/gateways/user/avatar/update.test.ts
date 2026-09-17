import { DateTime, Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import { avatarUrlForKey } from "@/lib/avatar-url";
import type { ErrorLogRecord } from "@/lib/report-error";
import { DriverFailed } from "@/test/defect";
import { AvatarBucket, AvatarKeyIds } from ".";
import { UserPersistenceError } from "..";
import {
  AvatarTypeUnsupported,
  AvatarUploadFailed,
  AvatarWriter,
  UserAvatarKeys,
} from "./update";

const AVATAR_UUID = "123e4567-e89b-42d3-a456-426614174000";
const NEW_KEY = `user-1/avatars/${AVATAR_UUID}.png`;
const NEW_URL = avatarUrlForKey(NEW_KEY);
const OLD_KEY = "user-1/avatar.jpg";
const TEST_CLOCK_INSTANT = "1970-01-01T00:00:00.000Z";

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

const persistenceFailure = (message: string) =>
  Effect.fail(
    new UserPersistenceError({ cause: new DriverFailed({ message }) })
  );

const makeFakes = () => {
  const findAvatarKey = vi.fn<UserAvatarKeys["Service"]["find"]>();
  const setAvatarKey = vi.fn<UserAvatarKeys["Service"]["set"]>();
  const remove = vi.fn<AvatarBucket["Service"]["remove"]>();
  const upload = vi.fn<AvatarBucket["Service"]["put"]>();

  findAvatarKey.mockReturnValue(
    Effect.succeed(Option.some(Option.some(OLD_KEY)))
  );
  setAvatarKey.mockReturnValue(Effect.succeed(1));
  remove.mockReturnValue(Effect.void);
  upload.mockReturnValue(Effect.void);

  const layer = AvatarWriter.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          AvatarKeyIds,
          AvatarKeyIds.of({ next: Effect.succeed(AVATAR_UUID) })
        ),
        Layer.succeed(
          AvatarBucket,
          AvatarBucket.of({
            get: vi.fn<AvatarBucket["Service"]["get"]>(),
            put: upload,
            remove,
          })
        ),
        Layer.succeed(
          UserAvatarKeys,
          UserAvatarKeys.of({ find: findAvatarKey, set: setAvatarKey })
        )
      )
    )
  );

  const runOrFailure = <A, E>(
    call: (writer: AvatarWriter["Service"]) => Effect.Effect<A, E>
  ): Promise<A | E> =>
    Effect.runPromise(
      Effect.gen(function* callGateway() {
        const writer = yield* AvatarWriter;
        return yield* call(writer);
      }).pipe(
        Effect.provide(layer),
        Effect.provide(TestClock.layer()),
        Effect.catch((error) => Effect.succeed(error))
      )
    );

  return {
    findAvatarKey,
    remove,
    runOrFailure,
    setAvatarKey,
    upload,
  };
};

const imageFile = (mimeType: string, bytes: number[]) =>
  new File([new Uint8Array(bytes)], "avatar", { type: mimeType });

const validPng = () =>
  imageFile("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("AvatarWriter.replace", () => {
  it.each([
    ["the MIME type is unsupported", imageFile("image/svg+xml", [0x3c])],
    [
      "the bytes do not match the MIME type",
      imageFile("image/png", [0xff, 0xd8, 0xff]),
    ],
  ])("should avoid every mutation when %s", (_label, file) => {
    const { remove, runOrFailure, setAvatarKey, upload } = makeFakes();

    return runOrFailure((writer) => writer.replace("user-1", file)).then(
      (result) => {
        expect({
          removeCalls: remove.mock.calls,
          result,
          updateCalls: setAvatarKey.mock.calls,
          uploadCalls: upload.mock.calls,
        }).toStrictEqual({
          removeCalls: [],
          result: new AvatarTypeUnsupported(),
          updateCalls: [],
          uploadCalls: [],
        });
      }
    );
  });

  it("should persist a unique key and remove the prior object when every step succeeds", () => {
    const { remove, runOrFailure, setAvatarKey, upload } = makeFakes();

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({
          removeCalls: remove.mock.calls,
          result,
          updateCalls: setAvatarKey.mock.calls.map(
            ([userId, avatarKey, updatedAt]) => [
              userId,
              avatarKey,
              DateTime.formatIso(updatedAt),
            ]
          ),
          uploadKey: upload.mock.calls[0]?.[0],
        }).toStrictEqual({
          removeCalls: [[OLD_KEY]],
          result: { avatarUrl: NEW_URL, cleanup: "complete" },
          updateCalls: [["user-1", NEW_KEY, TEST_CLOCK_INSTANT]],
          uploadKey: NEW_KEY,
        });
      }
    );
  });

  it("should report a failure when the current row is absent", () => {
    const { findAvatarKey, runOrFailure, upload } = makeFakes();
    findAvatarKey.mockReturnValue(Effect.succeed(Option.none()));

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({ result, uploadCalls: upload.mock.calls }).toStrictEqual({
          result: new AvatarUploadFailed(),
          uploadCalls: [],
        });
      }
    );
  });

  it("should report a failure when reading the current row fails", () => {
    const { findAvatarKey, runOrFailure, upload } = makeFakes();
    findAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));
    const reported = captureErrorReports();

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({
          reported,
          result,
          uploadCalls: upload.mock.calls,
        }).toStrictEqual({
          reported: [
            {
              event: "user.findAvatarKey",
              message: "D1 failed",
              name: "DriverFailed",
            },
          ],
          result: new AvatarUploadFailed(),
          uploadCalls: [],
        });
      }
    );
  });

  it("should report a failure when the upload fails", () => {
    const { remove, runOrFailure, upload } = makeFakes();
    upload.mockReturnValue(persistenceFailure("R2 put failed"));
    const reported = captureErrorReports();

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({
          removeCalls: remove.mock.calls,
          reported,
          result,
        }).toStrictEqual({
          removeCalls: [],
          reported: [
            {
              event: "user.upload",
              message: "R2 put failed",
              name: "DriverFailed",
            },
          ],
          result: new AvatarUploadFailed(),
        });
      }
    );
  });

  it("should remove the new object and preserve the old one when the update fails", () => {
    const { remove, runOrFailure, setAvatarKey } = makeFakes();
    setAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));
    const reported = captureErrorReports();

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({
          removeCalls: remove.mock.calls,
          reported,
          result,
        }).toStrictEqual({
          removeCalls: [[NEW_KEY]],
          reported: [
            {
              event: "user.setAvatarKey",
              message: "D1 failed",
              name: "DriverFailed",
            },
          ],
          result: new AvatarUploadFailed(),
        });
      }
    );
  });

  it("should roll back the new object when the update touches zero rows", () => {
    const { remove, runOrFailure, setAvatarKey } = makeFakes();
    setAvatarKey.mockReturnValue(Effect.succeed(0));
    const reported = captureErrorReports();

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({
          removeCalls: remove.mock.calls,
          reported,
          result,
        }).toStrictEqual({
          removeCalls: [[NEW_KEY]],
          reported: [
            {
              event: "user.setAvatarKey",
              message: "expected 1 row, got 0",
              name: "UnexpectedRowCount",
            },
          ],
          result: new AvatarUploadFailed(),
        });
      }
    );
  });

  it("should report the orphaned key when rollback deletion fails", () => {
    const { remove, runOrFailure, setAvatarKey } = makeFakes();
    setAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));
    remove.mockReturnValue(persistenceFailure("R2 delete failed"));
    const reported = captureErrorReports();

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({ reported, result }).toStrictEqual({
          reported: [
            {
              event: "user.setAvatarKey",
              message: "D1 failed",
              name: "DriverFailed",
            },
            {
              event: "user.rollbackUpload",
              message: "R2 delete failed",
              name: "DriverFailed",
            },
            {
              event: "user.rollbackUpload",
              message: `${NEW_KEY} was left in the bucket`,
              name: "AvatarObjectOrphaned",
            },
          ],
          result: new AvatarUploadFailed(),
        });
      }
    );
  });

  it("should return pending cleanup without failing the new avatar when old deletion fails", () => {
    const { remove, runOrFailure } = makeFakes();
    remove.mockReturnValue(persistenceFailure("R2 delete failed"));
    const reported = captureErrorReports();

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({ reported, result }).toStrictEqual({
          reported: [
            {
              event: "user.removePrevious",
              message: "R2 delete failed",
              name: "DriverFailed",
            },
          ],
          result: { avatarUrl: NEW_URL, cleanup: "pending" },
        });
      }
    );
  });

  it("should skip cleanup when the row holds no prior avatar", () => {
    const { findAvatarKey, remove, runOrFailure } = makeFakes();
    findAvatarKey.mockReturnValue(Effect.succeed(Option.some(Option.none())));

    return runOrFailure((writer) => writer.replace("user-1", validPng())).then(
      (result) => {
        expect({ removeCalls: remove.mock.calls, result }).toStrictEqual({
          removeCalls: [],
          result: { avatarUrl: NEW_URL, cleanup: "complete" },
        });
      }
    );
  });
});
