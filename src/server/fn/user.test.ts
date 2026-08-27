import { describe, expect, it, vi } from "vite-plus/test";
import type { getSession } from "@/lib/auth/session";
import { createGetCurrentUser } from "./user";
import type { CurrentUserDeps } from "./user";

const makeFakes = () => {
  const fetchCurrentUser = vi.fn<CurrentUserDeps["fetchCurrentUser"]>();
  const readSession = vi.fn<CurrentUserDeps["readSession"]>();
  return {
    fetchCurrentUser,
    getCurrentUser: createGetCurrentUser({ fetchCurrentUser, readSession }),
    readSession,
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

describe("getCurrentUser", () => {
  it("should return null without reading the gateway when the request is anonymous", async () => {
    const { fetchCurrentUser, getCurrentUser, readSession } = makeFakes();
    readSession.mockResolvedValue(null);

    const result = await getCurrentUser();

    expect({ fetchCalls: fetchCurrentUser.mock.calls, result }).toStrictEqual({
      fetchCalls: [],
      result: null,
    });
  });

  it("should pass the server-derived identity when the request is authenticated", async () => {
    const { fetchCurrentUser, getCurrentUser, readSession } = makeFakes();
    readSession.mockResolvedValue(authenticatedSession);
    fetchCurrentUser.mockResolvedValue(null);

    const result = await getCurrentUser();

    expect({ fetchCalls: fetchCurrentUser.mock.calls, result }).toStrictEqual({
      fetchCalls: [["user-1", "user-1@example.com"]],
      result: null,
    });
  });

  it("should propagate the error when session resolution fails", async () => {
    const { getCurrentUser, readSession } = makeFakes();
    readSession.mockRejectedValue(new Error("session failed"));

    const result = getCurrentUser();

    await expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the error when the gateway fails", async () => {
    const { fetchCurrentUser, getCurrentUser, readSession } = makeFakes();
    readSession.mockResolvedValue(authenticatedSession);
    fetchCurrentUser.mockRejectedValue(new Error("gateway failed"));

    const result = getCurrentUser();

    await expect(result).rejects.toThrow("gateway failed");
  });
});
