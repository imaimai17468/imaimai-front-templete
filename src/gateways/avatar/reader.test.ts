import { Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { CurrentSession } from "@/lib/auth/current-session.live";
import { AvatarGateway } from ".";
import type { AvatarObject } from ".";
import {
  AvatarInvalidKey,
  AvatarNotFound,
  AvatarReader,
  AvatarUnauthorized,
} from "./reader";

const makeFakes = (read: CurrentSession["Service"]["read"]) => {
  const fetchAvatar = vi.fn<AvatarGateway["Service"]["fetchAvatar"]>();
  const layer = AvatarReader.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(AvatarGateway, AvatarGateway.of({ fetchAvatar })),
        Layer.succeed(CurrentSession, CurrentSession.of({ read }))
      )
    )
  );
  return {
    fetchAvatar,
    readAvatarOrFailure: (key: string | null) =>
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

describe("AvatarReader.read", () => {
  it("should reject without reading persistence when the request is anonymous", () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(Option.none())
    );

    return readAvatarOrFailure("user-1/avatar.png").then((result) => {
      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [],
        result: new AvatarUnauthorized(),
      });
    });
  });

  it.each([
    ["the key is missing", null],
    ["the key belongs to another user", "user-2/avatar.png"],
    ["the key is malformed", "../user-1/avatar.png"],
  ])("should reject without reading persistence when %s", (_label, key) => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(signedInAs("user-1"))
    );

    return readAvatarOrFailure(key).then((result) => {
      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [],
        result: new AvatarInvalidKey(),
      });
    });
  });

  it("should fail with not-found when the owned object is absent", () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(signedInAs("user-1"))
    );
    fetchAvatar.mockReturnValue(Effect.succeed(null));

    return readAvatarOrFailure("user-1/avatar.png").then((result) => {
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
      contentType: "image/png",
    } satisfies AvatarObject;
    fetchAvatar.mockReturnValue(Effect.succeed(avatar));

    return readAvatarOrFailure("user-1/avatar.png").then((result) => {
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

    const result = readAvatarOrFailure("user-1/avatar.png");

    return expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the defect when persistence fails", () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(signedInAs("user-1"))
    );
    fetchAvatar.mockReturnValue(Effect.die(new Error("R2 failed")));

    const result = readAvatarOrFailure("user-1/avatar.png");

    return expect(result).rejects.toThrow("R2 failed");
  });
});
