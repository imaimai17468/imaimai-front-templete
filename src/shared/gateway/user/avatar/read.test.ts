import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { CurrentSession } from "@/lib/auth/session";
import { DriverFailed } from "@/test/defect";
import { AvatarBucket, AvatarObject } from ".";
import {
  AvatarInvalidKey,
  AvatarNotFound,
  AvatarReader,
  AvatarUnauthorized,
} from "./read";

const makeFakes = (read: CurrentSession["Service"]["read"]) => {
  const fetchAvatar = vi.fn<AvatarBucket["Service"]["get"]>();
  const layer = AvatarReader.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(
          AvatarBucket,
          AvatarBucket.of({
            get: fetchAvatar,
            put: vi.fn<AvatarBucket["Service"]["put"]>(),
            remove: vi.fn<AvatarBucket["Service"]["remove"]>(),
          })
        ),
        Layer.succeed(CurrentSession, CurrentSession.of({ read }))
      )
    )
  );
  return {
    fetchAvatar,
    readAvatarOrFailure: (key: Option.Option<string>) =>
      Effect.gen(function* callRead() {
        const reader = yield* AvatarReader;
        return yield* reader.read(key);
      }).pipe(
        Effect.provide(layer),
        Effect.catch((error) => Effect.succeed(error))
      ),
  };
};

const signedInAs = (userId: string) =>
  Option.some({ email: `${userId}@example.com`, id: userId });

const ownKey = Option.some("user-1/avatar.png");

const rejectedKeyCases = [
  ["the key is missing", Option.none()],
  ["the key belongs to another user", Option.some("user-2/avatar.png")],
  ["the key is malformed", Option.some("../user-1/avatar.png")],
] satisfies [string, Option.Option<string>][];

describe("AvatarReader.read", () => {
  it.effect(
    "should reject without reading persistence when the request is anonymous",
    () =>
      Effect.gen(function* rejectAnAnonymousRequest() {
        const { fetchAvatar, readAvatarOrFailure } = makeFakes(
          Effect.succeed(Option.none())
        );

        const result = yield* readAvatarOrFailure(ownKey);

        expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
          fetchCalls: [],
          result: new AvatarUnauthorized(),
        });
      })
  );

  it.effect.each(rejectedKeyCases)(
    "should reject without reading persistence when %s",
    ([_label, key]) =>
      Effect.gen(function* rejectAnInvalidKey() {
        const { fetchAvatar, readAvatarOrFailure } = makeFakes(
          Effect.succeed(signedInAs("user-1"))
        );

        const result = yield* readAvatarOrFailure(key);

        expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
          fetchCalls: [],
          result: new AvatarInvalidKey(),
        });
      })
  );

  it.effect("should fail with not-found when the owned object is absent", () =>
    Effect.gen(function* failWithNotFound() {
      const { fetchAvatar, readAvatarOrFailure } = makeFakes(
        Effect.succeed(signedInAs("user-1"))
      );
      fetchAvatar.mockReturnValue(Effect.succeed(Option.none()));

      const result = yield* readAvatarOrFailure(ownKey);

      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [["user-1/avatar.png"]],
        result: new AvatarNotFound(),
      });
    })
  );

  it.effect(
    "should return the gateway object when the owned object exists",
    () =>
      Effect.gen(function* returnTheGatewayObject() {
        const { fetchAvatar, readAvatarOrFailure } = makeFakes(
          Effect.succeed(signedInAs("user-1"))
        );
        const avatar = new AvatarObject(new ReadableStream(), "image/png");
        fetchAvatar.mockReturnValue(Effect.succeed(Option.some(avatar)));

        const result = yield* readAvatarOrFailure(ownKey);

        expect({
          fetchCalls: fetchAvatar.mock.calls,
          sameObject: result === avatar,
        }).toStrictEqual({
          fetchCalls: [["user-1/avatar.png"]],
          sameObject: true,
        });
      })
  );

  it.effect("should propagate the defect when session resolution fails", () =>
    Effect.gen(function* propagateTheSessionDefect() {
      const sessionFailure = new DriverFailed({ message: "session failed" });
      const { readAvatarOrFailure } = makeFakes(Effect.die(sessionFailure));

      const defect = yield* readAvatarOrFailure(ownKey).pipe(
        Effect.catchDefect(Effect.succeed)
      );

      expect(defect).toBe(sessionFailure);
    })
  );

  it.effect("should propagate the defect when persistence fails", () =>
    Effect.gen(function* propagateTheBucketDefect() {
      const { fetchAvatar, readAvatarOrFailure } = makeFakes(
        Effect.succeed(signedInAs("user-1"))
      );
      const bucketFailure = new DriverFailed({ message: "R2 failed" });
      fetchAvatar.mockReturnValue(Effect.die(bucketFailure));

      const defect = yield* readAvatarOrFailure(ownKey).pipe(
        Effect.catchDefect(Effect.succeed)
      );

      expect(defect).toBe(bucketFailure);
    })
  );
});
