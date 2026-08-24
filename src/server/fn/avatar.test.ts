import { describe, expect, it, vi } from "vitest";
import type { AvatarObject } from "@/gateways/avatar";
import type { getSession } from "@/lib/auth/session";
import { createReadAvatarForCurrentUser } from "./avatar";
import type { AvatarReadDeps } from "./avatar";

const makeFakes = () => {
  const fetchAvatar = vi.fn<AvatarReadDeps["fetchAvatar"]>();
  const readSession = vi.fn<AvatarReadDeps["readSession"]>();
  return {
    fetchAvatar,
    readAvatar: createReadAvatarForCurrentUser({ fetchAvatar, readSession }),
    readSession,
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

describe("readAvatarForCurrentUser", () => {
  it("should reject without reading persistence when the request is anonymous", async () => {
    const { fetchAvatar, readAvatar, readSession } = makeFakes();
    readSession.mockResolvedValue(null);

    const result = await readAvatar("user-1/avatar.png");

    expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
      fetchCalls: [],
      result: { kind: "unauthorized" },
    });
  });

  it.each([
    ["the key is missing", null],
    ["the key belongs to another user", "user-2/avatar.png"],
    ["the key is malformed", "../user-1/avatar.png"],
  ])(
    "should reject without reading persistence when %s",
    async (_label, key) => {
      const { fetchAvatar, readAvatar, readSession } = makeFakes();
      readSession.mockResolvedValue(sessionFor("user-1"));

      const result = await readAvatar(key);

      expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
        fetchCalls: [],
        result: { kind: "invalid-key" },
      });
    }
  );

  it("should return not-found when the owned object is absent", async () => {
    const { fetchAvatar, readAvatar, readSession } = makeFakes();
    readSession.mockResolvedValue(sessionFor("user-1"));
    fetchAvatar.mockResolvedValue(null);

    const result = await readAvatar("user-1/avatar.png");

    expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
      fetchCalls: [["user-1/avatar.png"]],
      result: { kind: "not-found" },
    });
  });

  it("should return the gateway object when the owned object exists", async () => {
    const { fetchAvatar, readAvatar, readSession } = makeFakes();
    const avatar = {
      body: new ReadableStream<Uint8Array>(),
      contentType: "image/png",
    } satisfies AvatarObject;
    readSession.mockResolvedValue(sessionFor("user-1"));
    fetchAvatar.mockResolvedValue(avatar);

    const result = await readAvatar("user-1/avatar.png");

    expect({ fetchCalls: fetchAvatar.mock.calls, result }).toStrictEqual({
      fetchCalls: [["user-1/avatar.png"]],
      result: { avatar, kind: "found" },
    });
  });

  it("should propagate the error when session resolution fails", async () => {
    const { readAvatar, readSession } = makeFakes();
    readSession.mockRejectedValue(new Error("session failed"));

    const result = readAvatar("user-1/avatar.png");

    await expect(result).rejects.toThrow("session failed");
  });

  it("should propagate the error when persistence fails", async () => {
    const { fetchAvatar, readAvatar, readSession } = makeFakes();
    readSession.mockResolvedValue(sessionFor("user-1"));
    fetchAvatar.mockRejectedValue(new Error("R2 failed"));

    const result = readAvatar("user-1/avatar.png");

    await expect(result).rejects.toThrow("R2 failed");
  });
});
