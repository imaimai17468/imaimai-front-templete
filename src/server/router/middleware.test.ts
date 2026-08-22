import { createRouterClient, os } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentUser } from "@/gateways/user";
import { getSession } from "@/lib/auth/session";
import { withUser } from "./middleware";

vi.mock("@/gateways/user", () => ({
  fetchCurrentUser: vi.fn<typeof fetchCurrentUser>(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn<typeof getSession>(),
}));

const authenticatedSession = {
  session: {
    id: "session-id",
    createdAt: new Date("2026-08-13T00:00:00Z"),
    updatedAt: new Date("2026-08-13T00:00:00Z"),
    userId: "user-1",
    expiresAt: new Date("2026-08-20T00:00:00Z"),
    token: "session-token",
    ipAddress: null,
    userAgent: null,
  },
  user: {
    id: "user-1",
    name: "Test User",
    email: "user-1@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date("2026-08-13T00:00:00Z"),
    updatedAt: new Date("2026-08-13T00:00:00Z"),
  },
} satisfies NonNullable<Awaited<ReturnType<typeof getSession>>>;

// Exercised through createRouterClient so the middleware runs on the same path
// the SSR caller uses, rather than being invoked directly.
const client = createRouterClient(
  { probe: os.use(withUser).handler(({ context }) => context.user) },
  { context: {} }
);

describe("withUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should bind no identity and skip the gateway when the request is anonymous", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await client.probe();

    expect({
      result,
      fetchCalls: vi.mocked(fetchCurrentUser).mock.calls,
    }).toEqual({ result: null, fetchCalls: [] });
  });

  it("should pass the server-derived identity when the request is authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(authenticatedSession);
    vi.mocked(fetchCurrentUser).mockResolvedValue(null);

    const result = await client.probe();

    expect({
      result,
      fetchCalls: vi.mocked(fetchCurrentUser).mock.calls,
    }).toEqual({
      result: null,
      fetchCalls: [["user-1", "user-1@example.com"]],
    });
  });

  it("should bind each caller's own identity when two calls overlap", async () => {
    const sessionFor = (id: string) => ({
      ...authenticatedSession,
      user: { ...authenticatedSession.user, id, email: `${id}@example.com` },
    });
    // Both resolutions are in flight before either resolves, so a resolver or
    // factory that memoized across calls would hand the same identity to both.
    const gate = Promise.withResolvers<void>();
    vi.mocked(getSession)
      .mockImplementationOnce(async () => {
        await gate.promise;
        return sessionFor("user-a");
      })
      .mockImplementationOnce(async () => {
        await Promise.resolve();
        return sessionFor("user-b");
      });
    vi.mocked(fetchCurrentUser).mockImplementation(async (id) => {
      await Promise.resolve();
      return {
        id,
        name: null,
        avatarUrl: null,
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
        email: `${id}@example.com`,
      };
    });

    const both = Promise.all([client.probe(), client.probe()]);
    gate.resolve();
    const [first, second] = await both;

    expect([first?.id, second?.id]).toEqual(["user-a", "user-b"]);
  });

  it("should propagate the error when session resolution fails", async () => {
    vi.mocked(getSession).mockRejectedValue(new Error("session failed"));

    await expect(client.probe()).rejects.toThrow("session failed");
  });

  it("should propagate the error when the gateway fails", async () => {
    vi.mocked(getSession).mockResolvedValue(authenticatedSession);
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error("gateway failed"));

    await expect(client.probe()).rejects.toThrow("gateway failed");
  });
});
