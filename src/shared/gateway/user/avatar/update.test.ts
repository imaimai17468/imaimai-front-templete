import { describe, expect, it, vi } from "@effect/vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { DateTime, Effect, Layer, Option } from "effect";
import { avatarUrlForKey } from "@/lib/avatar-url";
import { DriverFailed } from "@/test/defect";
import { capturedReports } from "@/test/error-reports";
import { AvatarBucket, AvatarKeyIds } from ".";
import { UserPersistenceError } from "..";
import {
  avatarKeyStillHeld,
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
  ): Effect.Effect<A | E> =>
    Effect.gen(function* callGateway() {
      const writer = yield* AvatarWriter;
      return yield* call(writer);
    }).pipe(
      Effect.provide(layer),
      Effect.catch((error) => Effect.succeed(error))
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
  it.effect.each([
    ["the MIME type is unsupported", imageFile("image/svg+xml", [0x3c])],
    [
      "the bytes do not match the MIME type",
      imageFile("image/png", [0xff, 0xd8, 0xff]),
    ],
  ] satisfies [string, File][])(
    "should avoid every mutation when %s",
    ([_label, file]) =>
      Effect.gen(function* avoidEveryMutation() {
        const { remove, runOrFailure, setAvatarKey, upload } = makeFakes();

        const result = yield* runOrFailure((writer) =>
          writer.replace("user-1", file)
        );

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
      })
  );

  it.effect(
    "should persist a unique key and remove the prior object when every step succeeds",
    () =>
      Effect.gen(function* persistAUniqueKeyAndRemoveThePriorObject() {
        const { remove, runOrFailure, setAvatarKey, upload } = makeFakes();

        const result = yield* runOrFailure((writer) =>
          writer.replace("user-1", validPng())
        );

        expect({
          removeCalls: remove.mock.calls,
          result,
          updateCalls: setAvatarKey.mock.calls.map(
            ([userId, previousKey, avatarKey, updatedAt]) => [
              userId,
              previousKey,
              avatarKey,
              DateTime.formatIso(updatedAt),
            ]
          ),
          uploadKey: upload.mock.calls[0]?.[0],
        }).toStrictEqual({
          removeCalls: [[OLD_KEY]],
          result: { avatarUrl: NEW_URL, cleanup: "complete" },
          updateCalls: [
            ["user-1", Option.some(OLD_KEY), NEW_KEY, TEST_CLOCK_INSTANT],
          ],
          uploadKey: NEW_KEY,
        });
      })
  );

  it.effect(
    "should leave the object in place when the stored key names another owner",
    () =>
      Effect.gen(function* leaveTheObjectInPlace() {
        const { findAvatarKey, remove, runOrFailure, upload } = makeFakes();
        findAvatarKey.mockReturnValue(
          Effect.succeed(Option.some(Option.some("user-2/avatar.png")))
        );

        const result = yield* runOrFailure((writer) =>
          writer.replace("user-1", validPng())
        );
        const reported = yield* capturedReports;

        expect({
          removeCalls: remove.mock.calls,
          reportedEvents: reported.map(({ event }) => event),
          result,
          uploadKey: upload.mock.calls[0]?.[0],
        }).toStrictEqual({
          removeCalls: [],
          reportedEvents: ["user.removePrevious"],
          result: { avatarUrl: NEW_URL, cleanup: "pending" },
          uploadKey: NEW_KEY,
        });
      })
  );

  it.effect("should report a failure when the current row is absent", () =>
    Effect.gen(function* failForAnAbsentRow() {
      const { findAvatarKey, runOrFailure, upload } = makeFakes();
      findAvatarKey.mockReturnValue(Effect.succeed(Option.none()));

      const result = yield* runOrFailure((writer) =>
        writer.replace("user-1", validPng())
      );

      expect({ result, uploadCalls: upload.mock.calls }).toStrictEqual({
        result: new AvatarUploadFailed(),
        uploadCalls: [],
      });
    })
  );

  it.effect("should report a failure when reading the current row fails", () =>
    Effect.gen(function* reportTheFailedRowRead() {
      const { findAvatarKey, runOrFailure, upload } = makeFakes();
      findAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));

      const result = yield* runOrFailure((writer) =>
        writer.replace("user-1", validPng())
      );
      const reported = yield* capturedReports;

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
    })
  );

  it.effect("should report a failure when the upload fails", () =>
    Effect.gen(function* reportTheFailedUpload() {
      const { remove, runOrFailure, upload } = makeFakes();
      upload.mockReturnValue(persistenceFailure("R2 put failed"));

      const result = yield* runOrFailure((writer) =>
        writer.replace("user-1", validPng())
      );
      const reported = yield* capturedReports;

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
    })
  );

  it.effect(
    "should remove the new object and preserve the old one when the update fails",
    () =>
      Effect.gen(function* removeTheNewObjectAndPreserveTheOldOne() {
        const { remove, runOrFailure, setAvatarKey } = makeFakes();
        setAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));

        const result = yield* runOrFailure((writer) =>
          writer.replace("user-1", validPng())
        );
        const reported = yield* capturedReports;

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
      })
  );

  it.effect(
    "should roll back the new object when the update touches zero rows",
    () =>
      Effect.gen(function* rollBackTheNewObject() {
        const { remove, runOrFailure, setAvatarKey } = makeFakes();
        setAvatarKey.mockReturnValue(Effect.succeed(0));

        const result = yield* runOrFailure((writer) =>
          writer.replace("user-1", validPng())
        );
        const reported = yield* capturedReports;

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
      })
  );

  it.effect("should report the orphaned key when rollback deletion fails", () =>
    Effect.gen(function* reportTheOrphanedKey() {
      const { remove, runOrFailure, setAvatarKey } = makeFakes();
      setAvatarKey.mockReturnValue(persistenceFailure("D1 failed"));
      remove.mockReturnValue(persistenceFailure("R2 delete failed"));

      const result = yield* runOrFailure((writer) =>
        writer.replace("user-1", validPng())
      );
      const reported = yield* capturedReports;

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
    })
  );

  it.effect(
    "should return pending cleanup without failing the new avatar when old deletion fails",
    () =>
      Effect.gen(function* returnPendingCleanupWithoutFailingTheNewAvatar() {
        const { remove, runOrFailure } = makeFakes();
        remove.mockReturnValue(persistenceFailure("R2 delete failed"));

        const result = yield* runOrFailure((writer) =>
          writer.replace("user-1", validPng())
        );
        const reported = yield* capturedReports;

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
      })
  );

  it.effect(
    "should require the row to hold no key when the row held no prior avatar",
    () =>
      Effect.gen(function* requireTheRowToHoldNoKey() {
        const { findAvatarKey, remove, runOrFailure, setAvatarKey } =
          makeFakes();
        findAvatarKey.mockReturnValue(
          Effect.succeed(Option.some(Option.none()))
        );

        const result = yield* runOrFailure((writer) =>
          writer.replace("user-1", validPng())
        );

        expect({
          previousKeys: setAvatarKey.mock.calls.map(
            ([, previousKey]) => previousKey
          ),
          removeCalls: remove.mock.calls,
          result,
        }).toStrictEqual({
          previousKeys: [Option.none()],
          removeCalls: [],
          result: { avatarUrl: NEW_URL, cleanup: "complete" },
        });
      })
  );
});

const PNG_KEY = NEW_KEY;
const GIF_KEY = `user-1/avatars/${AVATAR_UUID}.gif`;

const validGif = () =>
  imageFile("image/gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

/**
 * A row and a bucket that the fakes read and write, so two uploads that both
 * read `OLD_KEY` before either writes meet the same compare-and-set a D1
 * `where avatar_key = ?` performs.
 */
const makeSharedStore = () => {
  const fakes = makeFakes();
  const store = {
    objects: new Set([OLD_KEY]),
    row: Option.some(OLD_KEY),
  };
  fakes.upload.mockImplementation((key) =>
    Effect.sync(() => {
      store.objects.add(key);
    })
  );
  fakes.remove.mockImplementation((key) =>
    Effect.sync(() => {
      store.objects.delete(key);
    })
  );
  fakes.setAvatarKey.mockImplementation((_userId, previousKey, avatarKey) =>
    Effect.sync(() => {
      if (Option.getOrNull(store.row) !== Option.getOrNull(previousKey)) {
        return 0;
      }
      store.row = Option.some(avatarKey);
      return 1;
    })
  );
  return { ...fakes, store };
};

const raceCases = [
  ["the PNG upload writes first", validPng, validGif, PNG_KEY, GIF_KEY],
  ["the GIF upload writes first", validGif, validPng, GIF_KEY, PNG_KEY],
] satisfies [string, () => File, () => File, string, string][];

describe("AvatarWriter.replace racing another upload", () => {
  it.effect.each(raceCases)(
    "should leave only the winner's object and the row naming it when %s",
    ([_label, firstFile, secondFile, winnerKey, loserKey]) =>
      Effect.gen(function* leaveOnlyTheWinnerObjectAndTheRowNamingIt() {
        const { remove, runOrFailure, store } = makeSharedStore();

        const results = yield* runOrFailure((writer) =>
          Effect.all([
            writer.replace("user-1", firstFile()),
            writer.replace("user-1", secondFile()).pipe(Effect.flip),
          ])
        );
        const reported = yield* capturedReports;

        expect({
          objects: [...store.objects],
          removeCalls: remove.mock.calls,
          reportedEvents: reported.map(({ event }) => event),
          results,
          row: store.row,
        }).toStrictEqual({
          objects: [winnerKey],
          removeCalls: [[OLD_KEY], [loserKey]],
          reportedEvents: ["user.setAvatarKey"],
          results: [
            { avatarUrl: avatarUrlForKey(winnerKey), cleanup: "complete" },
            new AvatarUploadFailed(),
          ],
          row: Option.some(winnerKey),
        });
      })
  );
});

describe(avatarKeyStillHeld, () => {
  it.each([
    [
      "the row held a key",
      Option.some(OLD_KEY),
      { params: [OLD_KEY], sql: '"users"."avatar_key" = ?' },
    ],
    [
      "the row held no key",
      Option.none(),
      { params: [], sql: '"users"."avatar_key" is null' },
    ],
  ])(
    "should match only a row still holding what was read when %s",
    (_label, previousKey, expected) => {
      const { params, sql } = new SQLiteSyncDialect().sqlToQuery(
        avatarKeyStillHeld(previousKey)
      );

      expect({ params, sql }).toStrictEqual(expected);
    }
  );
});
