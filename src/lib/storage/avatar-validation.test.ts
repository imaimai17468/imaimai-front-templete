import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  avatarContentMatchesMime,
  avatarExtensionForMime,
  avatarSizeRejection,
  isOwnAvatarKey,
  MAX_AVATAR_BYTES,
} from "./avatar-validation";

describe(avatarExtensionForMime, () => {
  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
  ])(
    "should return the extension when the allowed type %s maps to %s",
    (mime, ext) => {
      expect(avatarExtensionForMime(mime)).toStrictEqual(Option.some(ext));
    }
  );

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
  ])(
    "should return a None when the type %j is disallowed or malformed",
    (mime) => {
      expect(avatarExtensionForMime(mime)).toStrictEqual(Option.none());
    }
  );
});

describe(avatarSizeRejection, () => {
  it.each([
    ["zero bytes", 0],
    ["negative size", -1],
  ])("should return empty when the size is %s", (_label, size) => {
    expect(avatarSizeRejection(size)).toStrictEqual(Option.some("empty"));
  });

  it.each([
    ["one byte over the ceiling", MAX_AVATAR_BYTES + 1],
    ["far over the ceiling", MAX_AVATAR_BYTES * 10],
  ])("should return too-large when the size is %s", (_label, size) => {
    expect(avatarSizeRejection(size)).toStrictEqual(Option.some("too-large"));
  });

  it.each([
    ["the smallest non-empty size", 1],
    ["exactly the ceiling", MAX_AVATAR_BYTES],
  ])("should return a None when the size is %s", (_label, size) => {
    expect(avatarSizeRejection(size)).toStrictEqual(Option.none());
  });
});

describe(isOwnAvatarKey, () => {
  it.each([
    ["user-123/avatar.png", "user-123"],
    ["aB0_-x/avatar.jpg", "aB0_-x"],
    ["u/avatar.webp", "u"],
    ["u/avatar.gif", "u"],
    ["user-123/avatars/123e4567-e89b-42d3-a456-426614174000.png", "user-123"],
    // legacy variants tolerated on read (written before the hardening)
    ["user-123/avatar.jpeg", "user-123"],
    ["user-123/avatar.PNG", "user-123"],
    ["user-123/avatar.JPG", "user-123"],
    // uppercase + jpeg together (both tolerances at once)
    ["user-123/avatar.JPEG", "user-123"],
  ])("should accept the key %s when the caller owns it", (key, userId) => {
    expect(isOwnAvatarKey(key, userId)).toBeTruthy();
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
  ])("should reject the key when it is %s (%j)", (_label, key) => {
    expect(isOwnAvatarKey(key, "user-123")).toBeFalsy();
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
    (_label, mimeType, bytes) =>
      expect(
        avatarContentMatchesMime(imageFile(mimeType, bytes))
      ).resolves.toBeTruthy()
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
  ])("should reject content when %s", (_label, mimeType, bytes) =>
    expect(
      avatarContentMatchesMime(imageFile(mimeType, bytes))
    ).resolves.toBeFalsy()
  );
});
