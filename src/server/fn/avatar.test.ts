import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAvatar, type AvatarObject } from "@/gateways/avatar";
import { getSession } from "@/lib/auth/session";
import { readAvatarForCurrentUser } from "./avatar";

vi.mock("@/gateways/avatar", () => ({
  fetchAvatar: vi.fn<typeof fetchAvatar>(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn<typeof getSession>(),
}));

const sessionFor = (userId: string) =>
  ({
    session: {
      id: "session-id",
      createdAt: new Date("2026-08-13T00:00:00Z"),
      updatedAt: new Date("2026-08-13T00:00:00Z"),
      userId,
      expiresAt: new Date("2026-08-20T00:00:00Z"),
      token: "session-token",
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: userId,
      name: "Test User",
      email: `${userId}@example.com`,
      emailVerified: true,
      image: null,
      createdAt: new Date("2026-08-13T00:00:00Z"),
      updatedAt: new Date("2026-08-13T00:00:00Z"),
    },
  }) satisfies NonNullable<Awaited<ReturnType<typeof getSession>>>;

describe("readAvatarForCurrentUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should reject without reading persistence when the request is anonymous", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const result = await readAvatarForCurrentUser("user-1/avatar.png");

    expect({
      result,
      fetchCalls: vi.mocked(fetchAvatar).mock.calls,
    }).toEqual({
      result: { kind: "unauthorized" },
      fetchCalls: [],
    });
  });

  it.each([
    ["the key is missing", null],
    ["the key belongs to another user", "user-2/avatar.png"],
    ["the key is malformed", "../user-1/avatar.png"],
  ])(
    "should reject without reading persistence when %s",
    async (_label, key) => {
      vi.mocked(getSession).mockResolvedValue(sessionFor("user-1"));

      const result = await readAvatarForCurrentUser(key);

      expect({
        result,
        fetchCalls: vi.mocked(fetchAvatar).mock.calls,
      }).toEqual({
        result: { kind: "invalid-key" },
        fetchCalls: [],
      });
    }
  );

  it("should return not-found when the owned object is absent", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor("user-1"));
    vi.mocked(fetchAvatar).mockResolvedValue(null);

    const result = await readAvatarForCurrentUser("user-1/avatar.png");

    expect({
      result,
      fetchCalls: vi.mocked(fetchAvatar).mock.calls,
    }).toEqual({
      result: { kind: "not-found" },
      fetchCalls: [["user-1/avatar.png"]],
    });
  });

  it("should return the gateway object when the owned object exists", async () => {
    const avatar = {
      body: new ReadableStream<Uint8Array>(),
      contentType: "image/png",
    } satisfies AvatarObject;
    vi.mocked(getSession).mockResolvedValue(sessionFor("user-1"));
    vi.mocked(fetchAvatar).mockResolvedValue(avatar);

    const result = await readAvatarForCurrentUser("user-1/avatar.png");

    expect({
      result,
      fetchCalls: vi.mocked(fetchAvatar).mock.calls,
    }).toEqual({
      result: { kind: "found", avatar },
      fetchCalls: [["user-1/avatar.png"]],
    });
  });

  it("should propagate the error when session resolution fails", async () => {
    vi.mocked(getSession).mockRejectedValue(new Error("session failed"));

    const result = readAvatarForCurrentUser("user-1/avatar.png");

    await expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the error when persistence fails", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor("user-1"));
    vi.mocked(fetchAvatar).mockRejectedValue(new Error("R2 failed"));

    const result = readAvatarForCurrentUser("user-1/avatar.png");

    await expect(result).rejects.toThrow("R2 failed");
  });
});
