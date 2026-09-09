import { describe, expect, it, vi } from "vite-plus/test";
import type { UserWithEmail } from "@/entities/user";
import { MAX_AVATAR_BYTES } from "@/lib/storage/avatar-validation";
import {
  createUpdateProfile,
  createUploadAvatar,
  parseAvatarUpload,
  parseProfileUpdate,
} from "./profile";
import type { AvatarUploadDeps, ProfileUpdateDeps } from "./profile";

const makeProfileFakes = () => {
  const readCurrentUser = vi.fn<ProfileUpdateDeps["readCurrentUser"]>();
  const updateUser = vi.fn<ProfileUpdateDeps["updateUser"]>();
  return {
    readCurrentUser,
    updateProfile: createUpdateProfile({ readCurrentUser, updateUser }),
    updateUser,
  };
};

const makeAvatarFakes = () => {
  const readCurrentUser = vi.fn<AvatarUploadDeps["readCurrentUser"]>();
  const updateUserAvatar = vi.fn<AvatarUploadDeps["updateUserAvatar"]>();
  return {
    readCurrentUser,
    updateUserAvatar,
    uploadAvatar: createUploadAvatar({ readCurrentUser, updateUserAvatar }),
  };
};

const pngFile = (byteLength: number) =>
  new File([new Uint8Array(byteLength)], "a.png", { type: "image/png" });

const authenticatedUser = {
  avatarUrl: null,
  createdAt: "2026-08-13T00:00:00Z",
  email: "user-1@example.com",
  id: "user-1",
  name: "Test User",
  updatedAt: "2026-08-13T00:00:00Z",
} satisfies UserWithEmail;

describe(parseProfileUpdate, () => {
  it("should reject when the input is not FormData", () => {
    const data = {};

    const parse = () => parseProfileUpdate(data);

    expect(parse).toThrow("Expected FormData");
  });

  it("should return the parsed name when the name is valid", () => {
    const data = new FormData();
    data.set("name", "Updated User");

    const result = parseProfileUpdate(data);

    expect(result).toStrictEqual({ name: "Updated User" });
  });

  it.each([
    ["empty", "", "Name is required"],
    [
      "over 50 characters",
      "a".repeat(51),
      "Name must be 50 characters or less",
    ],
  ])("should reject when the name is %s", (_label, name, message) => {
    const data = new FormData();
    data.set("name", name);

    const parse = () => parseProfileUpdate(data);

    expect(parse).toThrow(message);
  });
});

describe(parseAvatarUpload, () => {
  it("should reject when the input is not FormData", () => {
    const data = {};

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("Expected FormData");
  });

  it("should reject when the avatar entry is absent", () => {
    const data = new FormData();

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("No file selected");
  });

  it("should reject when the avatar entry is not a File", () => {
    const data = new FormData();
    data.set("avatar", "a.png");

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("No file selected");
  });

  it("should reject when the avatar is empty", () => {
    const data = new FormData();
    data.set("avatar", pngFile(0));

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow("No file selected");
  });

  it("should reject when the avatar exceeds the size limit", () => {
    const data = new FormData();
    data.set("avatar", pngFile(MAX_AVATAR_BYTES + 1));

    const parse = () => parseAvatarUpload(data);

    expect(parse).toThrow(
      `Avatar must be ${MAX_AVATAR_BYTES / 1024 / 1024}MB or smaller`
    );
  });

  it("should return the file when the avatar size is acceptable", () => {
    const file = pngFile(1);
    const data = new FormData();
    data.set("avatar", file);

    const result = parseAvatarUpload(data);

    expect(result).toStrictEqual({ file });
  });
});

describe("updateProfile", () => {
  it("should reject without writing persistence when the request is anonymous", async () => {
    const { readCurrentUser, updateProfile, updateUser } = makeProfileFakes();
    readCurrentUser.mockResolvedValue(null);

    const result = await updateProfile({ name: "Updated User" });

    expect({ result, updateCalls: updateUser.mock.calls }).toStrictEqual({
      result: { error: "Not authenticated" },
      updateCalls: [],
    });
  });

  it("should pass the server-derived identity and return the gateway result when the request is authenticated", async () => {
    const { readCurrentUser, updateProfile, updateUser } = makeProfileFakes();
    const data = { name: "Updated User" };
    readCurrentUser.mockResolvedValue(authenticatedUser);
    updateUser.mockResolvedValue({ success: true });

    const result = await updateProfile(data);

    expect({ result, updateCalls: updateUser.mock.calls }).toStrictEqual({
      result: { success: true },
      updateCalls: [["user-1", data]],
    });
  });
});

describe("uploadAvatar", () => {
  it("should reject without writing persistence when the request is anonymous", async () => {
    const { readCurrentUser, updateUserAvatar, uploadAvatar } =
      makeAvatarFakes();
    const file = pngFile(1);
    readCurrentUser.mockResolvedValue(null);

    const result = await uploadAvatar({ file });

    expect({ result, updateCalls: updateUserAvatar.mock.calls }).toStrictEqual({
      result: { error: "Not authenticated" },
      updateCalls: [],
    });
  });

  it("should pass the server-derived identity and return the gateway result when the request is authenticated", async () => {
    const { readCurrentUser, updateUserAvatar, uploadAvatar } =
      makeAvatarFakes();
    const file = pngFile(1);
    readCurrentUser.mockResolvedValue(authenticatedUser);
    updateUserAvatar.mockResolvedValue({
      avatarUrl: "/api/avatars?key=user-1/avatar.png",
      cleanup: "complete",
      success: true,
    });

    const result = await uploadAvatar({ file });

    expect({ result, updateCalls: updateUserAvatar.mock.calls }).toStrictEqual({
      result: {
        avatarUrl: "/api/avatars?key=user-1/avatar.png",
        cleanup: "complete",
        success: true,
      },
      updateCalls: [["user-1", file]],
    });
  });
});
