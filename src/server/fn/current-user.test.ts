import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { UserGateway, UserPersistenceError } from "@/gateways/user";
import { CurrentSession } from "@/lib/auth/current-session.live";
import type { getSession } from "@/lib/auth/session.live";
import { CurrentUserReader, readCurrentUser } from "./current-user";

// similarity-ignore: avatar.test.ts の makeFakes とは別のサービス（AvatarReader vs
// CurrentUserReader）の Layer を組む。CurrentSession を差し替える形が一致しているだけで、
// 共通化すると片方のサービスの依存が変わるたびにもう片方のテストが動く。
const makeFakes = (read: CurrentSession["Service"]["read"]) => {
  const fetchCurrentUser = vi.fn<UserGateway["Service"]["fetchCurrentUser"]>();
  const layer = CurrentUserReader.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        Layer.succeed(CurrentSession, CurrentSession.of({ read })),
        Layer.succeed(
          UserGateway,
          UserGateway.of({
            fetchCurrentUser,
            updateUser: vi.fn<UserGateway["Service"]["updateUser"]>(),
            updateUserAvatar:
              vi.fn<UserGateway["Service"]["updateUserAvatar"]>(),
          })
        )
      )
    )
  );

  return {
    fetchCurrentUser,
    readCurrentUser: async () =>
      await Effect.runPromise(readCurrentUser.pipe(Effect.provide(layer))),
  };
};

const authenticatedSession = {
  session: {
    createdAt: new Date("2026-08-13T00:00:00Z"),
    expiresAt: new Date("2026-08-20T00:00:00Z"),
    id: "session-id",
    ipAddress: null,
    token: "session-token",
    updatedAt: new Date("2026-08-13T00:00:00Z"),
    userAgent: null,
    userId: "user-1",
  },
  user: {
    createdAt: new Date("2026-08-13T00:00:00Z"),
    email: "user-1@example.com",
    emailVerified: true,
    id: "user-1",
    image: null,
    name: "Test User",
    updatedAt: new Date("2026-08-13T00:00:00Z"),
  },
} satisfies NonNullable<Awaited<ReturnType<typeof getSession>>>;

describe("CurrentUserReader.read", () => {
  it("should return null without reading the gateway when the request is anonymous", async () => {
    const { fetchCurrentUser, readCurrentUser: read } = makeFakes(
      Effect.succeed(null)
    );

    const result = await read();

    expect({ fetchCalls: fetchCurrentUser.mock.calls, result }).toStrictEqual({
      fetchCalls: [],
      result: null,
    });
  });

  it("should pass the server-derived identity when the request is authenticated", async () => {
    const { fetchCurrentUser, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedSession)
    );
    fetchCurrentUser.mockReturnValue(Effect.succeed(null));

    const result = await read();

    expect({ fetchCalls: fetchCurrentUser.mock.calls, result }).toStrictEqual({
      fetchCalls: [["user-1", "user-1@example.com"]],
      result: null,
    });
  });

  it("should propagate the defect when session resolution fails", async () => {
    const { readCurrentUser: read } = makeFakes(
      Effect.die(new Error("session failed"))
    );

    const result = read();

    await expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the cause as a defect when the gateway read fails", async () => {
    const { fetchCurrentUser, readCurrentUser: read } = makeFakes(
      Effect.succeed(authenticatedSession)
    );
    fetchCurrentUser.mockReturnValue(
      Effect.fail(new UserPersistenceError({ cause: new Error("D1 failed") }))
    );

    const result = read();

    await expect(result).rejects.toThrow("D1 failed");
  });
});
