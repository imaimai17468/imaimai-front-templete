import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCurrentUser,
  updateUser,
  updateUserAvatar,
} from "@/gateways/user";
import { getSession } from "@/lib/auth/session";
import { MAX_AVATAR_BYTES } from "@/lib/storage/avatar-validation";
import { update, uploadAvatar } from "./profile";

vi.mock("@/gateways/user", () => ({
  fetchCurrentUser: vi.fn<typeof fetchCurrentUser>(),
  updateUser: vi.fn<typeof updateUser>(),
  updateUserAvatar: vi.fn<typeof updateUserAvatar>(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn<typeof getSession>(),
}));

const client = createRouterClient({ update, uploadAvatar }, { context: {} });

const anonymous = () => {
  vi.mocked(getSession).mockResolvedValue(null);
};

const authenticated = () => {
  vi.mocked(getSession).mockResolvedValue({
    session: {
      id: "s",
      createdAt: new Date("2026-08-13T00:00:00Z"),
      updatedAt: new Date("2026-08-13T00:00:00Z"),
      userId: "user-1",
      expiresAt: new Date("2026-08-20T00:00:00Z"),
      token: "t",
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
  });
  vi.mocked(fetchCurrentUser).mockResolvedValue({
    id: "user-1",
    name: "Test User",
    avatarUrl: null,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    email: "user-1@example.com",
  });
};

const png = (bytes: number) =>
  new File([new Uint8Array(bytes)], "a.png", { type: "image/png" });

describe("profile.update", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should refuse without touching the gateway when the request is anonymous", async () => {
    anonymous();

    const result = await client.update({ name: "Ada" });

    expect({ result, calls: vi.mocked(updateUser).mock.calls }).toEqual({
      result: { error: "Not authenticated" },
      calls: [],
    });
  });

  it("should pass the server-derived id when the request is authenticated", async () => {
    authenticated();
    vi.mocked(updateUser).mockResolvedValue({ success: true });

    await client.update({ name: "Ada" });

    expect(vi.mocked(updateUser).mock.calls).toEqual([
      ["user-1", { name: "Ada" }],
    ]);
  });
});

describe("profile.uploadAvatar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should refuse without touching the gateway when the request is anonymous", async () => {
    anonymous();

    const result = await client.uploadAvatar({ file: png(10) });

    expect({ result, calls: vi.mocked(updateUserAvatar).mock.calls }).toEqual({
      result: { error: "Not authenticated" },
      calls: [],
    });
  });

  it("should reject the input when the file is empty", async () => {
    authenticated();

    await expect(client.uploadAvatar({ file: png(0) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("should reject the input when the file exceeds the ceiling", async () => {
    authenticated();

    await expect(
      client.uploadAvatar({ file: png(MAX_AVATAR_BYTES + 1) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("should pass the server-derived id and the caller's file when within the ceiling", async () => {
    authenticated();
    vi.mocked(updateUserAvatar).mockResolvedValue({
      success: true,
      avatarUrl: "/api/avatars?key=user-1%2Fa.png",
      cleanup: "complete",
    });
    const file = png(10);

    await client.uploadAvatar({ file });

    const call = vi.mocked(updateUserAvatar).mock.calls[0];
    // Reference identity, not toEqual: File exposes size/type/name as getters,
    // and the same instance flows straight through on the in-process path.
    expect({ id: call?.[0], sameFile: call?.[1] === file }).toEqual({
      id: "user-1",
      sameFile: true,
    });
  });
});
