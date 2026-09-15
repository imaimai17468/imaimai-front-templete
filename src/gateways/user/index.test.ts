import { DateTime, Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ErrorReport } from "@/lib/report-error";
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
const NEW_URL = `/api/avatars?key=${encodeURIComponent(NEW_KEY)}`;
const OLD_KEY = "user-1/avatar.jpg";
const OLD_URL = `/api/avatars?key=${encodeURIComponent(OLD_KEY)}`;
const TEST_CLOCK_INSTANT = "1970-01-01T00:00:00.000Z";

type CapturedReport = Pick<ErrorReport, "event" | "message" | "name">;

const captureErrorReports = (): CapturedReport[] => {
  const reported: CapturedReport[] = [];
  vi.spyOn(console, "error").mockImplementation((payload: ErrorReport) => {
    reported.push({
      event: payload.event,
      message: payload.message,
      name: payload.name,
    });
  });
  return reported;
};

const persistenceFailure = (message: string) =>
  Effect.fail(new UserPersistenceError({ cause: new Error(message) }));

const makeFakes = () => {
  const findAvatarUrl = vi.fn<UserStore["Service"]["findAvatarUrl"]>();
  const findProfile = vi.fn<UserStore["Service"]["findProfile"]>();
  const setAvatarUrl = vi.fn<UserStore["Service"]["setAvatarUrl"]>();
  const updateName = vi.fn<UserStore["Service"]["updateName"]>();
  const remove = vi.fn<AvatarStorage["Service"]["remove"]>();
  const upload = vi.fn<AvatarStorage["Service"]["upload"]>();

  findAvatarUrl.mockReturnValue(Effect.succeed({ avatarUrl: OLD_URL }));
  setAvatarUrl.mockReturnValue(Effect.succeed(1));
  updateName.mockReturnValue(Effect.void);
  remove.mockReturnValue(Effect.void);
  upload.mockReturnValue(Effect.succeed(NEW_URL));

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
          UserStore.of({ findAvatarUrl, findProfile, setAvatarUrl, updateName })
        )
      )
    )
  );

  const runOrFailure = async <A, E>(
    call: (gateway: UserGateway["Service"]) => Effect.Effect<A, E>
  ): Promise<A | E> =>
    await Effect.runPromise(
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
    findAvatarUrl,
    findProfile,
    remove,
    runOrFailure,
    setAvatarUrl,
    updateName,
    upload,
  };
};

const imageFile = (mimeType: string, bytes: number[]) =>
  new File([new Uint8Array(bytes)], "avatar", { type: mimeType });

const validPng = () =>
  imageFile("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("user gateway", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("updateUserAvatar", () => {
    it.each([
      ["the MIME type is unsupported", imageFile("image/svg+xml", [0x3c])],
      [
        "the bytes do not match the MIME type",
        imageFile("image/png", [0xff, 0xd8, 0xff]),
      ],
    ])("should avoid every mutation when %s", async (_label, file) => {
      const { remove, runOrFailure, setAvatarUrl, upload } = makeFakes();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", file)
      );

      expect({
        removeCalls: remove.mock.calls,
        result,
        updateCalls: setAvatarUrl.mock.calls,
        uploadCalls: upload.mock.calls,
      }).toStrictEqual({
        removeCalls: [],
        result: new AvatarTypeUnsupported(),
        updateCalls: [],
        uploadCalls: [],
      });
    });

    it("should persist a unique key and remove the prior object when every step succeeds", async () => {
      const { remove, runOrFailure, setAvatarUrl, upload } = makeFakes();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({
        removeCalls: remove.mock.calls,
        result,
        updateCalls: setAvatarUrl.mock.calls.map(
          ([userId, avatarUrl, updatedAt]) => [
            userId,
            avatarUrl,
            DateTime.formatIso(updatedAt),
          ]
        ),
        uploadKey: upload.mock.calls[0]?.[0],
      }).toStrictEqual({
        removeCalls: [[OLD_KEY]],
        result: { avatarUrl: NEW_URL, cleanup: "complete" },
        updateCalls: [["user-1", NEW_URL, TEST_CLOCK_INSTANT]],
        uploadKey: NEW_KEY,
      });
    });

    it("should report a failure when the current row is absent", async () => {
      const { findAvatarUrl, runOrFailure, upload } = makeFakes();
      findAvatarUrl.mockReturnValue(Effect.succeed(null));

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({ result, uploadCalls: upload.mock.calls }).toStrictEqual({
        result: new AvatarUploadFailed({ orphanedKey: null }),
        uploadCalls: [],
      });
    });

    it("should report a failure when reading the current row fails", async () => {
      const { findAvatarUrl, runOrFailure, upload } = makeFakes();
      findAvatarUrl.mockReturnValue(persistenceFailure("D1 failed"));
      const reported = captureErrorReports();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({
        reported,
        result,
        uploadCalls: upload.mock.calls,
      }).toStrictEqual({
        reported: [
          { event: "user.findAvatarUrl", message: "D1 failed", name: "Error" },
        ],
        result: new AvatarUploadFailed({ orphanedKey: null }),
        uploadCalls: [],
      });
    });

    it("should report a failure when the upload fails", async () => {
      const { remove, runOrFailure, upload } = makeFakes();
      upload.mockReturnValue(persistenceFailure("R2 put failed"));
      const reported = captureErrorReports();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({
        removeCalls: remove.mock.calls,
        reported,
        result,
      }).toStrictEqual({
        removeCalls: [],
        reported: [
          { event: "user.upload", message: "R2 put failed", name: "Error" },
        ],
        result: new AvatarUploadFailed({ orphanedKey: null }),
      });
    });

    it("should remove the new object and preserve the old one when the update fails", async () => {
      const { remove, runOrFailure, setAvatarUrl } = makeFakes();
      setAvatarUrl.mockReturnValue(persistenceFailure("D1 failed"));
      const reported = captureErrorReports();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({
        removeCalls: remove.mock.calls,
        reported,
        result,
      }).toStrictEqual({
        removeCalls: [[NEW_KEY]],
        reported: [
          { event: "user.setAvatarUrl", message: "D1 failed", name: "Error" },
        ],
        result: new AvatarUploadFailed({ orphanedKey: null }),
      });
    });

    it("should roll back the new object when the update touches zero rows", async () => {
      const { remove, runOrFailure, setAvatarUrl } = makeFakes();
      setAvatarUrl.mockReturnValue(Effect.succeed(0));
      const reported = captureErrorReports();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({
        removeCalls: remove.mock.calls,
        reported,
        result,
      }).toStrictEqual({
        removeCalls: [[NEW_KEY]],
        reported: [
          {
            event: "user.setAvatarUrl",
            message: "expected 1 row, got 0",
            name: "Error",
          },
        ],
        result: new AvatarUploadFailed({ orphanedKey: null }),
      });
    });

    it("should report the orphaned key when rollback deletion fails", async () => {
      const { remove, runOrFailure, setAvatarUrl } = makeFakes();
      setAvatarUrl.mockReturnValue(persistenceFailure("D1 failed"));
      remove.mockReturnValue(persistenceFailure("R2 delete failed"));
      const reported = captureErrorReports();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({ reported, result }).toStrictEqual({
        reported: [
          { event: "user.setAvatarUrl", message: "D1 failed", name: "Error" },
          {
            event: "user.rollbackUpload",
            message: "R2 delete failed",
            name: "Error",
          },
        ],
        result: new AvatarUploadFailed({ orphanedKey: NEW_KEY }),
      });
    });

    it("should return pending cleanup without failing the new avatar when old deletion fails", async () => {
      const { remove, runOrFailure } = makeFakes();
      remove.mockReturnValue(persistenceFailure("R2 delete failed"));
      const reported = captureErrorReports();

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({ reported, result }).toStrictEqual({
        reported: [
          {
            event: "user.removePrevious",
            message: "R2 delete failed",
            name: "Error",
          },
        ],
        result: { avatarUrl: NEW_URL, cleanup: "pending" },
      });
    });

    it.each([
      ["the row holds no prior avatar", null],
      ["the prior image is external", "https://images.example.com/avatar.png"],
    ])("should skip cleanup when %s", async (_label, avatarUrl) => {
      const { findAvatarUrl, remove, runOrFailure } = makeFakes();
      findAvatarUrl.mockReturnValue(Effect.succeed({ avatarUrl }));

      const result = await runOrFailure((gateway) =>
        gateway.updateUserAvatar("user-1", validPng())
      );

      expect({ removeCalls: remove.mock.calls, result }).toStrictEqual({
        removeCalls: [],
        result: { avatarUrl: NEW_URL, cleanup: "complete" },
      });
    });
  });

  describe("updateUser", () => {
    it("should stamp the row with the clock's instant when the name update resolves", async () => {
      const { runOrFailure, updateName } = makeFakes();

      await runOrFailure((gateway) =>
        gateway.updateUser("user-1", { name: "New Name" })
      );

      expect(
        updateName.mock.calls.map(([userId, name, updatedAt]) => [
          userId,
          name,
          DateTime.formatIso(updatedAt),
        ])
      ).toStrictEqual([["user-1", "New Name", TEST_CLOCK_INSTANT]]);
    });

    it("should report a failure when the name update fails", async () => {
      const { runOrFailure, updateName } = makeFakes();
      updateName.mockReturnValue(persistenceFailure("D1 failed"));
      const reported = captureErrorReports();

      const result = await runOrFailure((gateway) =>
        gateway.updateUser("user-1", { name: "New Name" })
      );

      expect({ reported, result }).toStrictEqual({
        reported: [
          { event: "user.updateName", message: "D1 failed", name: "Error" },
        ],
        result: new UserNameUpdateFailed(),
      });
    });
  });

  describe("fetchCurrentUser", () => {
    it("should return null when no profile row exists", async () => {
      const { findProfile, runOrFailure } = makeFakes();
      findProfile.mockReturnValue(Effect.succeed(null));

      const result = await runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      );

      expect(result).toBeNull();
    });

    it("should return the parsed user when a profile row exists", async () => {
      const { findProfile, runOrFailure } = makeFakes();
      findProfile.mockReturnValue(
        Effect.succeed({
          createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
          id: "user-1",
          image: null,
          name: "Name",
          updatedAt: DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"),
        })
      );

      const result = await runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      );

      expect(result).toStrictEqual({
        avatarUrl: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        email: "user@example.com",
        id: "user-1",
        name: "Name",
        updatedAt: "2026-01-02T00:00:00.000Z",
      });
    });

    it("should surface the persistence failure when the profile read fails", async () => {
      const { findProfile, runOrFailure } = makeFakes();
      const cause = new Error("D1 failed");
      findProfile.mockReturnValue(
        Effect.fail(new UserPersistenceError({ cause }))
      );

      const result = await runOrFailure((gateway) =>
        gateway.fetchCurrentUser("user-1", "user@example.com")
      );

      expect(result).toStrictEqual(new UserPersistenceError({ cause }));
    });
  });
});
