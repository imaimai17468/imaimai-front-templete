import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { AvatarGateway } from "@/gateways/avatar";
import type { AvatarObject } from "@/gateways/avatar";
import { CurrentSession } from "@/lib/auth/current-session.live";
import type { getSession } from "@/lib/auth/session.live";
import {
  AvatarInvalidKey,
  AvatarNotFound,
  AvatarReader,
  AvatarUnauthorized,
} from "./avatar";

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
    readAvatarOrFailure: async (key: string | null) =>
      await Effect.runPromise(
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

const sessionFor = (userId: string) =>
  ({
    session: {
      createdAt: new Date("2026-08-13T00:00:00Z"),
      expiresAt: new Date("2026-08-20T00:00:00Z"),
      id: "session-id",
      ipAddress: null,
      token: "session-token",
      updatedAt: new Date("2026-08-13T00:00:00Z"),
      userAgent: null,
      userId,
    },
    user: {
      createdAt: new Date("2026-08-13T00:00:00Z"),
      email: `${userId}@example.com`,
      emailVerified: true,
      id: userId,
      image: null,
      name: "Test User",
      updatedAt: new Date("2026-08-13T00:00:00Z"),
    },
  }) satisfies NonNullable<Awaited<ReturnType<typeof getSession>>>;

describe("AvatarReader.read", () => {
  it("should reject without reading persistence when the request is anonymous", async () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(null)
    );

    const result = await readAvatarOrFailure("user-1/avatar.png");

    expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
      fetchCalls: [],
      result: new AvatarUnauthorized(),
    });
  });

  it.each([
    ["the key is missing", null],
    ["the key belongs to another user", "user-2/avatar.png"],
    ["the key is malformed", "../user-1/avatar.png"],
  ])(
    "should reject without reading persistence when %s",
    async (_label, key) => {
      const { fetchAvatar, readAvatarOrFailure } = makeFakes(
        Effect.succeed(sessionFor("user-1"))
      );

      const result = await readAvatarOrFailure(key);

      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [],
        result: new AvatarInvalidKey(),
      });
    }
  );

  it("should fail with not-found when the owned object is absent", async () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(sessionFor("user-1"))
    );
    fetchAvatar.mockReturnValue(Effect.succeed(null));

    const result = await readAvatarOrFailure("user-1/avatar.png");

    expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
      fetchCalls: [["user-1/avatar.png"]],
      result: new AvatarNotFound(),
    });
  });

  it("should return the gateway object when the owned object exists", async () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(sessionFor("user-1"))
    );
    const avatar = {
      body: new ReadableStream<Uint8Array>(),
      contentType: "image/png",
    } satisfies AvatarObject;
    fetchAvatar.mockReturnValue(Effect.succeed(avatar));

    const result = await readAvatarOrFailure("user-1/avatar.png");

    expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
      fetchCalls: [["user-1/avatar.png"]],
      result: avatar,
    });
  });

  it("should propagate the defect when session resolution fails", async () => {
    const { readAvatarOrFailure } = makeFakes(
      Effect.die(new Error("session failed"))
    );

    const result = readAvatarOrFailure("user-1/avatar.png");

    await expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the defect when persistence fails", async () => {
    const { fetchAvatar, readAvatarOrFailure } = makeFakes(
      Effect.succeed(sessionFor("user-1"))
    );
    fetchAvatar.mockReturnValue(Effect.die(new Error("R2 failed")));

    const result = readAvatarOrFailure("user-1/avatar.png");

    await expect(result).rejects.toThrow("R2 failed");
  });
});
