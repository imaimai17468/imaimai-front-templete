import { describe, expect, it } from "vite-plus/test";
import {
  avatarContentMatchesMime,
  avatarExtensionForMime,
  avatarKeyFromUrl,
  avatarSizeRejection,
  isOwnAvatarKey,
  isValidAvatarKey,
  MAX_AVATAR_BYTES,
} from "./avatar-validation";

describe(avatarExtensionForMime, () => {
  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
  ])("maps allowed type %s to extension %s", (mime, ext) => {
    expect(avatarExtensionForMime(mime)).toBe(ext);
  });

  it.each([
    "text/html",
    "image/svg+xml",
    "application/octet-stream",
    "image/png; charset=utf-8",
    "IMAGE/PNG",
    "",
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "valueOf",
  ])("rejects disallowed or malformed type %j", (mime) => {
    expect(avatarExtensionForMime(mime)).toBeNull();
  });
});

describe(isValidAvatarKey, () => {
  it.each([
    "user-123/avatar.png",
    "aB0_-x/avatar.jpg",
    "u/avatar.webp",
    "u/avatar.gif",
    "user-123/avatars/123e4567-e89b-42d3-a456-426614174000.png",
    // legacy variants tolerated on read (written before the hardening)
    "user-123/avatar.jpeg",
    "user-123/avatar.PNG",
    "user-123/avatar.JPG",
    // uppercase + jpeg together (both tolerances at once)
    "user-123/avatar.JPEG",
  ])("accepts well-formed key %s", (key) => {
    expect(isValidAvatarKey(key)).toBeTruthy();
  });

  it.each([
    ["empty", ""],
    ["missing prefix", "avatar.png"],
    ["empty prefix", "/avatar.png"],
    ["path traversal", "../secrets/avatar.png"],
    ["nested path", "a/b/avatar.png"],
    ["wrong filename", "user-123/other.png"],
    ["disallowed extension", "user-123/avatar.svg"],
    ["html extension", "user-123/avatar.html"],
    ["trailing garbage", "user-123/avatar.png.html"],
    ["prefix with dot", "user.123/avatar.png"],
    ["no extension", "user-123/avatar"],
    ["versioned key with malformed UUID", "user-123/avatars/not-a-uuid.png"],
  ])("rejects %s: %j", (_label, key) => {
    expect(isValidAvatarKey(key)).toBeFalsy();
  });
});

describe(avatarSizeRejection, () => {
  it.each([
    ["zero bytes", 0],
    ["negative size", -1],
  ])("rejects %s as empty", (_label, size) => {
    expect(avatarSizeRejection(size)).toBe("empty");
  });

  it.each([
    ["one byte over the ceiling", MAX_AVATAR_BYTES + 1],
    ["far over the ceiling", MAX_AVATAR_BYTES * 10],
  ])("rejects %s as too-large", (_label, size) => {
    expect(avatarSizeRejection(size)).toBe("too-large");
  });

  it.each([
    ["the smallest non-empty size", 1],
    ["exactly the ceiling", MAX_AVATAR_BYTES],
  ])("accepts %s", (_label, size) => {
    expect(avatarSizeRejection(size)).toBeNull();
  });
});

describe(isOwnAvatarKey, () => {
  it("should accept the key when it is well-formed and owned by the caller", () => {
    expect(isOwnAvatarKey("user-123/avatar.png", "user-123")).toBeTruthy();
  });

  it.each([
    ["owned by another user", "user-456/avatar.png", "user-123"],
    [
      "malformed filename with a matching prefix",
      "user-123/other.png",
      "user-123",
    ],
    [
      "disallowed extension with a matching prefix",
      "user-123/avatar.svg",
      "user-123",
    ],
    [
      "caller id is a prefix of the key's owner",
      "user-12/avatar.png",
      "user-1",
    ],
    ["caller id is empty", "/avatar.png", ""],
  ])("should reject the key when %s", (_label, key, userId) => {
    expect(isOwnAvatarKey(key, userId)).toBeFalsy();
  });
});

const imageFile = (mimeType: string, bytes: number[]) =>
  new File([new Uint8Array(bytes)], "avatar", { type: mimeType });

describe(avatarContentMatchesMime, () => {
  it.each([
    ["PNG", "image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["JPEG", "image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    [
      "WebP",
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    ],
    ["GIF87a", "image/gif", [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]],
    ["GIF89a", "image/gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  ])(
    "should accept %s bytes when the MIME type matches",
    async (_label, mimeType, bytes) => {
      await expect(
        avatarContentMatchesMime(imageFile(mimeType, bytes))
      ).resolves.toBeTruthy();
    }
  );

  it.each([
    ["PNG MIME with JPEG bytes", "image/png", [0xff, 0xd8, 0xff]],
    [
      "WebP MIME with RIFF but no WEBP marker",
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x4e, 0x4f, 0x50, 0x45],
    ],
    ["GIF MIME with a truncated header", "image/gif", [0x47, 0x49, 0x46]],
    ["unsupported MIME", "image/svg+xml", [0x3c, 0x73, 0x76, 0x67]],
  ])("should reject content when %s", async (_label, mimeType, bytes) => {
    await expect(
      avatarContentMatchesMime(imageFile(mimeType, bytes))
    ).resolves.toBeFalsy();
  });
});

describe(avatarKeyFromUrl, () => {
  it.each([
    ["legacy key", "/api/avatars?key=user-1%2Favatar.png", "user-1/avatar.png"],
    [
      "versioned key",
      "/api/avatars?key=user-1%2Favatars%2F123e4567-e89b-42d3-a456-426614174000.webp",
      "user-1/avatars/123e4567-e89b-42d3-a456-426614174000.webp",
    ],
  ])(
    "should return the owned %s when the URL is internal",
    (_label, avatarUrl, expected) => {
      expect(avatarKeyFromUrl(avatarUrl, "user-1")).toBe(expected);
    }
  );

  it.each([
    ["external URL", "https://images.example.com/avatar.png"],
    ["wrong route", "/images/avatar.png?key=user-1%2Favatar.png"],
    ["foreign key", "/api/avatars?key=user-2%2Favatar.png"],
    ["missing key", "/api/avatars"],
    ["malformed key", "/api/avatars?key=..%2Favatar.png"],
  ])("should return null when the URL contains an %s", (_label, avatarUrl) => {
    expect(avatarKeyFromUrl(avatarUrl, "user-1")).toBeNull();
  });
});
