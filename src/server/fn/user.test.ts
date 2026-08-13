import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentUser } from "@/gateways/user";
import { getSession } from "@/lib/auth/session";
import { getCurrentUser } from "./user";

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

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return null without reading the gateway when the request is anonymous", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await getCurrentUser();

    expect({
      result,
      fetchCalls: vi.mocked(fetchCurrentUser).mock.calls,
    }).toEqual({
      result: null,
      fetchCalls: [],
    });
  });

  it("should pass the server-derived identity when the request is authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(authenticatedSession);
    vi.mocked(fetchCurrentUser).mockResolvedValue(null);

    const result = await getCurrentUser();

    expect({
      result,
      fetchCalls: vi.mocked(fetchCurrentUser).mock.calls,
    }).toEqual({
      result: null,
      fetchCalls: [["user-1", "user-1@example.com"]],
    });
  });

  it("should propagate the error when session resolution fails", async () => {
    vi.mocked(getSession).mockRejectedValue(new Error("session failed"));

    const result = getCurrentUser();

    await expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the error when the gateway fails", async () => {
    vi.mocked(getSession).mockResolvedValue(authenticatedSession);
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error("gateway failed"));

    const result = getCurrentUser();

    await expect(result).rejects.toThrow("gateway failed");
  });
});
