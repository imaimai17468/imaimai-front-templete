import { describe, expect, it, vi } from "vite-plus/test";
import { createUserGateway } from ".";
import type { AvatarStorage, UserGatewayDeps, UserStore } from "./ports";

const AVATAR_UUID = "123e4567-e89b-42d3-a456-426614174000";
const NEW_KEY = `user-1/avatars/${AVATAR_UUID}.png`;
const NEW_URL = `/api/avatars?key=${encodeURIComponent(NEW_KEY)}`;
const OLD_KEY = "user-1/avatar.jpg";
const OLD_URL = `/api/avatars?key=${encodeURIComponent(OLD_KEY)}`;

const makeFakes = () => {
  const findAvatarUrl = vi.fn<UserStore["findAvatarUrl"]>();
  const setAvatarUrl = vi.fn<UserStore["setAvatarUrl"]>();
  const upload = vi.fn<AvatarStorage["upload"]>();
  const remove = vi.fn<AvatarStorage["remove"]>();

  findAvatarUrl.mockResolvedValue({ avatarUrl: OLD_URL });
  setAvatarUrl.mockResolvedValue(1);
  upload.mockResolvedValue(NEW_URL);
  remove.mockResolvedValue();

  const deps: UserGatewayDeps = {
    newId: () => AVATAR_UUID,
    storage: { remove, upload },
    store: {
      findAvatarUrl,
      findProfile: vi.fn<UserStore["findProfile"]>(),
      setAvatarUrl,
      updateName: vi.fn<UserStore["updateName"]>(),
    },
  };

  return { deps, findAvatarUrl, remove, setAvatarUrl, upload };
};

const imageFile = (mimeType: string, bytes: number[]) =>
  new File([new Uint8Array(bytes)], "avatar", { type: mimeType });

const validPng = () =>
  imageFile("image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("updateUserAvatar", () => {
  it.each([
    ["the MIME type is unsupported", imageFile("image/svg+xml", [0x3c])],
    [
      "the bytes do not match the MIME type",
      imageFile("image/png", [0xff, 0xd8, 0xff]),
    ],
  ])("should avoid every mutation when %s", async (_label, file) => {
    const { deps, remove, setAvatarUrl, upload } = makeFakes();

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      file
    );

    expect({
      removeCalls: remove.mock.calls,
      result,
      updateCalls: setAvatarUrl.mock.calls,
      uploadCalls: upload.mock.calls,
    }).toStrictEqual({
      removeCalls: [],
      result: { error: "Unsupported image type", success: false },
      updateCalls: [],
      uploadCalls: [],
    });
  });

  it("should persist a unique key and remove the prior object when every step succeeds", async () => {
    const { deps, remove, setAvatarUrl, upload } = makeFakes();

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect({
      removeCalls: remove.mock.calls,
      result,
      updateCalls: setAvatarUrl.mock.calls.length,
      uploadKey: upload.mock.calls[0]?.[0],
    }).toStrictEqual({
      removeCalls: [[OLD_KEY]],
      result: {
        avatarUrl: NEW_URL,
        cleanup: "complete",
        success: true,
      },
      updateCalls: 1,
      uploadKey: NEW_KEY,
    });
  });

  it("should report a failure when the current row is absent", async () => {
    const { deps, findAvatarUrl, upload } = makeFakes();
    findAvatarUrl.mockResolvedValue(null);

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect({ result, uploadCalls: upload.mock.calls }).toStrictEqual({
      result: { error: "Failed to upload avatar", success: false },
      uploadCalls: [],
    });
  });

  it("should report a failure when reading the current row rejects", async () => {
    const { deps, findAvatarUrl, upload } = makeFakes();
    findAvatarUrl.mockRejectedValue(new Error("D1 failed"));

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect({ result, uploadCalls: upload.mock.calls }).toStrictEqual({
      result: { error: "Failed to upload avatar", success: false },
      uploadCalls: [],
    });
  });

  it("should report a failure when the upload rejects", async () => {
    const { deps, remove, upload } = makeFakes();
    upload.mockRejectedValue(new Error("R2 put failed"));

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect({ removeCalls: remove.mock.calls, result }).toStrictEqual({
      removeCalls: [],
      result: { error: "Failed to upload avatar", success: false },
    });
  });

  it("should remove the new object and preserve the old one when the update rejects", async () => {
    const { deps, remove, setAvatarUrl } = makeFakes();
    setAvatarUrl.mockRejectedValue(new Error("D1 failed"));

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect({ removeCalls: remove.mock.calls, result }).toStrictEqual({
      removeCalls: [[NEW_KEY]],
      result: { error: "Failed to upload avatar", success: false },
    });
  });

  it("should roll back the new object when the update touches zero rows", async () => {
    const { deps, remove, setAvatarUrl } = makeFakes();
    setAvatarUrl.mockResolvedValue(0);

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect({ removeCalls: remove.mock.calls, result }).toStrictEqual({
      removeCalls: [[NEW_KEY]],
      result: { error: "Failed to upload avatar", success: false },
    });
  });

  it("should report the orphaned key when rollback deletion fails", async () => {
    const { deps, remove, setAvatarUrl } = makeFakes();
    setAvatarUrl.mockRejectedValue(new Error("D1 failed"));
    remove.mockRejectedValue(new Error("R2 delete failed"));

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect(result).toStrictEqual({
      error: "Failed to upload avatar",
      orphanedKey: NEW_KEY,
      success: false,
    });
  });

  it("should return pending cleanup without failing the new avatar when old deletion fails", async () => {
    const { deps, remove } = makeFakes();
    remove.mockRejectedValue(new Error("R2 delete failed"));

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect(result).toStrictEqual({
      avatarUrl: NEW_URL,
      cleanup: "pending",
      success: true,
    });
  });

  it("should skip cleanup when the prior image is external", async () => {
    const { deps, findAvatarUrl, remove } = makeFakes();
    findAvatarUrl.mockResolvedValue({
      avatarUrl: "https://images.example.com/avatar.png",
    });

    const result = await createUserGateway(deps).updateUserAvatar(
      "user-1",
      validPng()
    );

    expect({ removeCalls: remove.mock.calls, result }).toStrictEqual({
      removeCalls: [],
      result: {
        avatarUrl: NEW_URL,
        cleanup: "complete",
        success: true,
      },
    });
  });
});

describe("updateUser", () => {
  it("should report success when the name update resolves", async () => {
    const { deps } = makeFakes();

    const result = await createUserGateway(deps).updateUser("user-1", {
      name: "New Name",
    });

    expect(result).toStrictEqual({ success: true });
  });

  it("should report a failure when the name update rejects", async () => {
    const { deps } = makeFakes();
    vi.mocked(deps.store.updateName).mockRejectedValue(new Error("D1 failed"));

    const result = await createUserGateway(deps).updateUser("user-1", {
      name: "New Name",
    });

    expect(result).toStrictEqual({
      error: "Failed to update profile",
      success: false,
    });
  });
});

describe("fetchCurrentUser", () => {
  it("should return null when no profile row exists", async () => {
    const { deps } = makeFakes();
    vi.mocked(deps.store.findProfile).mockResolvedValue(null);

    const result = await createUserGateway(deps).fetchCurrentUser(
      "user-1",
      "user@example.com"
    );

    expect(result).toBeNull();
  });

  it("should return the parsed user when a profile row exists", async () => {
    const { deps } = makeFakes();
    vi.mocked(deps.store.findProfile).mockResolvedValue({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      id: "user-1",
      image: null,
      name: "Name",
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const result = await createUserGateway(deps).fetchCurrentUser(
      "user-1",
      "user@example.com"
    );

    expect(result).toStrictEqual({
      avatarUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "user@example.com",
      id: "user-1",
      name: "Name",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });
});
