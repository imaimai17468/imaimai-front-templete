import { Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { CurrentSession } from "@/lib/auth/current-session.live";
import { AvatarBucket } from ".";
import type { AvatarObject } from ".";
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
      Effect.runPromise(
        Effect.gen(function* callRead() {
          const reader = yield* AvatarReader;
          return yield* reader.read(key);
        }).pipe(
          Effect.provide(layer),
          Effect.catch((error) => Effect.succeed(error))
        )
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
  it("should reject without reading persistence when the request is anonymous", () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(Option.none())
    );

    return readAvatarOrFailure(ownKey).then((result) => {
      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [],
        result: new AvatarUnauthorized(),
      });
    });
  });

  it.each(rejectedKeyCases)(
    "should reject without reading persistence when %s",
    (_label, key) => {
      const { fetchAvatar, readAvatarOrFailure } = makeFakes(
        Effect.succeed(signedInAs("user-1"))
      );

      return readAvatarOrFailure(key).then((result) => {
        expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
          fetchCalls: [],
          result: new AvatarInvalidKey(),
        });
      });
    }
  );

  it("should fail with not-found when the owned object is absent", () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(signedInAs("user-1"))
    );
    fetchAvatar.mockReturnValue(Effect.succeed(Option.none()));

    return readAvatarOrFailure(ownKey).then((result) => {
      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [["user-1/avatar.png"]],
        result: new AvatarNotFound(),
      });
    });
  });

  it("should return the gateway object when the owned object exists", () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(signedInAs("user-1"))
    );
    const avatar = {
      body: new ReadableStream<Uint8Array>(),
      contentType: Option.some("image/png"),
    } satisfies AvatarObject;
    fetchAvatar.mockReturnValue(Effect.succeed(Option.some(avatar)));

    return readAvatarOrFailure(ownKey).then((result) => {
      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [["user-1/avatar.png"]],
        result: avatar,
      });
    });
  });

  it("should propagate the defect when session resolution fails", () => {
    const { readAvatarOrFailure } = makeFakes(
      Effect.die(new Error("session failed"))
    );

    const result = readAvatarOrFailure(ownKey);

    return expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the defect when persistence fails", () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(signedInAs("user-1"))
    );
    fetchAvatar.mockReturnValue(Effect.die(new Error("R2 failed")));

    const result = readAvatarOrFailure(ownKey);

    return expect(result).rejects.toThrow("R2 failed");
  });
});
