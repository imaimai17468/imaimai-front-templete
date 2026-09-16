import { DateTime, Effect, Layer, Option } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vite-plus/test";
import { avatarUrlForKey } from "@/lib/avatar-url";
import type { ErrorLogRecord } from "@/lib/report-error";
import { DriverFailed } from "@/test/defect";
import {
  AvatarKeyIds,
  AvatarStorage,
  AvatarTypeUnsupported,
  AvatarUploadFailed,
  UserGateway,
  UserNameUpdateFailed,
  UserPersistenceError,
  UserStore,
} from ".";

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
  const findAvatarKey = vi.fn<UserStore["Service"]["findAvatarKey"]>();
  const findProfile = vi.fn<UserStore["Service"]["findProfile"]>();
  const setAvatarKey = vi.fn<UserStore["Service"]["setAvatarKey"]>();
  const updateName = vi.fn<UserStore["Service"]["updateName"]>();
  const remove = vi.fn<AvatarStorage["Service"]["remove"]>();
  const upload = vi.fn<AvatarStorage["Service"]["upload"]>();

  findAvatarKey.mockReturnValue(
    Effect.succeed(Option.some({ avatarKey: Option.some(OLD_KEY) }))
  );
  setAvatarKey.mockReturnValue(Effect.succeed(1));
  updateName.mockReturnValue(Effect.void);
  remove.mockReturnValue(Effect.void);
  upload.mockReturnValue(Effect.void);

  const layer = UserGateway.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(
          AvatarKeyIds,
          AvatarKeyIds.of({ next: Effect.succeed(AVATAR_UUID) })
        ),
        Layer.succeed(AvatarStorage, AvatarStorage.of({ remove, upload })),
        Layer.succeed(
          UserStore,
          UserStore.of({ findAvatarKey, findProfile, setAvatarKey, updateName })
        )
      )
    )
  );

  const runOrFailure = <A, E>(
    call: (gateway: UserGateway["Service"]) => Effect.Effect<A, E>
  ): Promise<A | E> =>
    Effect.runPromise(
      Effect.gen(function* callGateway() {
        const gateway = yield* UserGateway;
        return yield* call(gateway);
      }).pipe(
        Effect.provide(layer),
        Effect.provide(TestClock.layer()),
        Effect.catch((error) => Effect.succeed(error))
      )
    );

  return {
    findAvatarKey,
    findProfile,
    remove,
    runOrFailure,
    setAvatarKey,
    updateName,
    upload,
  };
};

const imageFile = (mimeType: string, bytes: number[]) =>
  new File([new Uint8Array(bytes)], "avatar", { type: mimeType });

const validPng = () =>
  imageFile("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("user gateway", () => {
  describe("updateUserAvatar", () => {
    it.each([
      ["the MIME type is unsupported", imageFile("image/svg+xml", [0x3c])],
      [
        "the bytes do not match the MIME type",
        imageFile("image/png", [0xff, 0xd8, 0xff]),
      ],
    ])("should avoid every mutation when %s", (_label, file) => {
      const { remove, runOrFailure, setAvatarKey, upload } = makeFakes();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", file)
      ).then((result) => {
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
      });
    });

    it("should persist a unique key and remove the prior object when every step succeeds", () => {
      const { remove, runOrFailure, setAvatarKey, upload } = makeFakes();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
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
      });
    });

    it("should report a failure when the current row is absent", () => {
      const { findAvatarKey, runOrFailure, upload } = makeFakes();
      findAvatarKey.mockReturnValue(Effect.succeed(Option.none()));

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
        expect({ result, uploadCalls: upload.mock.calls }).toStrictEqual({
          result: new AvatarUploadFailed({ orphanedKey: null }),
          uploadCalls: [],
        });
      });
    });

    it("should report a failure when reading the current row fails", () => {
      const { findAvatarKey, runOrFailure, upload } = makeFakes();
      findAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));
      const reported = captureErrorReports();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
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
          result: new AvatarUploadFailed({ orphanedKey: null }),
          uploadCalls: [],
        });
      });
    });

    it("should report a failure when the upload fails", () => {
      const { remove, runOrFailure, upload } = makeFakes();
      upload.mockReturnValue(persistenceFailure("R2 put failed"));
      const reported = captureErrorReports();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
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
          result: new AvatarUploadFailed({ orphanedKey: null }),
        });
      });
    });

    it("should remove the new object and preserve the old one when the update fails", () => {
      const { remove, runOrFailure, setAvatarKey } = makeFakes();
      setAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));
      const reported = captureErrorReports();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
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
          result: new AvatarUploadFailed({ orphanedKey: null }),
        });
      });
    });

    it("should roll back the new object when the update touches zero rows", () => {
      const { remove, runOrFailure, setAvatarKey } = makeFakes();
      setAvatarKey.mockReturnValue(Effect.succeed(0));
      const reported = captureErrorReports();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
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
          result: new AvatarUploadFailed({ orphanedKey: null }),
        });
      });
    });

    it("should report the orphaned key when rollback deletion fails", () => {
      const { remove, runOrFailure, setAvatarKey } = makeFakes();
      setAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));
      remove.mockReturnValue(persistenceFailure("R2 delete failed"));
      const reported = captureErrorReports();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
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
          ],
          result: new AvatarUploadFailed({ orphanedKey: NEW_KEY }),
        });
      });
    });

    it("should return pending cleanup without failing the new avatar when old deletion fails", () => {
      const { remove, runOrFailure } = makeFakes();
      remove.mockReturnValue(persistenceFailure("R2 delete failed"));
      const reported = captureErrorReports();

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
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
      });
    });

    it("should skip cleanup when the row holds no prior avatar", () => {
      const { findAvatarKey, remove, runOrFailure } = makeFakes();
      findAvatarKey.mockReturnValue(
        Effect.succeed(Option.some({ avatarKey: Option.none() }))
      );

      return runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      ).then((result) => {
        expect({ removeCalls: remove.mock.calls, result }).toStrictEqual({
          removeCalls: [],
          result: { avatarUrl: NEW_URL, cleanup: "complete" },
        });
      });
    });
  });

  describe("updateUser", () => {
    it("should stamp the row with the clock's instant when the name update resolves", () => {
      const { runOrFailure, updateName } = makeFakes();

      return runOrFailure((gateway) =>
        gateway.updateUser("user-1", { name: "New Name" })
      ).then((result) => {
        expect({
          result,
          updateCalls: updateName.mock.calls.map(
            ([userId, name, updatedAt]) => [
              userId,
              name,
              DateTime.formatIso(updatedAt),
            ]
          ),
        }).toStrictEqual({
          result: undefined,
          updateCalls: [
            ["user-1", Option.some("New Name"), TEST_CLOCK_INSTANT],
          ],
        });
      });
    });

    it("should report a failure when the name update fails", () => {
      const { runOrFailure, updateName } = makeFakes();
      updateName.mockReturnValue(persistenceFailure("D1 failed"));
      const reported = captureErrorReports();

      return runOrFailure((gateway) =>
        gateway.updateUser("user-1", { name: "New Name" })
      ).then((result) => {
        expect({ reported, result }).toStrictEqual({
          reported: [
            {
              event: "user.updateName",
              message: "D1 failed",
              name: "DriverFailed",
            },
          ],
          result: new UserNameUpdateFailed(),
        });
      });
    });
  });

  describe("fetchCurrentUser", () => {
    it("should return None when no profile row exists", () => {
      const { findProfile, runOrFailure } = makeFakes();
      findProfile.mockReturnValue(Effect.succeed(Option.none()));

      return runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      ).then((result) => {
        expect(result).toStrictEqual(Option.none());
      });
    });

    it("should return the parsed user when a profile row exists", () => {
      const { findProfile, runOrFailure } = makeFakes();
      findProfile.mockReturnValue(
        Effect.succeed(
          Option.some({
            avatarKey: Option.none(),
            createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
            id: "user-1",
            image: Option.none(),
            name: Option.some("Name"),
            updatedAt: DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"),
          })
        )
      );

      return runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      ).then((result) => {
        expect(result).toStrictEqual(
          Option.some({
            avatarUrl: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            email: "user@example.com",
            id: "user-1",
            name: "Name",
            updatedAt: "2026-01-02T00:00:00.000Z",
          })
        );
      });
    });

    it("should serve the uploaded avatar when the row holds a key", () => {
      const { findProfile, runOrFailure } = makeFakes();
      findProfile.mockReturnValue(
        Effect.succeed(
          Option.some({
            avatarKey: Option.some(OLD_KEY),
            createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
            id: "user-1",
            image: Option.some("https://images.example.com/from-google.png"),
            name: Option.some("Name"),
            updatedAt: DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"),
          })
        )
      );

      return runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      ).then((result) => {
        expect(result).toStrictEqual(
          Option.some({
            avatarUrl: avatarUrlForKey(OLD_KEY),
            createdAt: "2026-01-01T00:00:00.000Z",
            email: "user@example.com",
            id: "user-1",
            name: "Name",
            updatedAt: "2026-01-02T00:00:00.000Z",
          })
        );
      });
    });

    it("should fall back to the provider's image when the row holds no key", () => {
      const { findProfile, runOrFailure } = makeFakes();
      findProfile.mockReturnValue(
        Effect.succeed(
          Option.some({
            avatarKey: Option.none(),
            createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
            id: "user-1",
            image: Option.some("https://images.example.com/from-google.png"),
            name: Option.some("Name"),
            updatedAt: DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"),
          })
        )
      );

      return runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      ).then((result) => {
        expect(result).toStrictEqual(
          Option.some({
            avatarUrl: "https://images.example.com/from-google.png",
            createdAt: "2026-01-01T00:00:00.000Z",
            email: "user@example.com",
            id: "user-1",
            name: "Name",
            updatedAt: "2026-01-02T00:00:00.000Z",
          })
        );
      });
    });

    it("should surface the persistence failure when the profile read fails", () => {
      const { findProfile, runOrFailure } = makeFakes();
      const cause = new DriverFailed({ message: "D1 failed" });
      findProfile.mockReturnValue(
        Effect.fail(new UserPersistenceError({ cause }))
      );

      return runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      ).then((result) => {
        expect(result).toStrictEqual(new UserPersistenceError({ cause }));
      });
    });
  });
});
