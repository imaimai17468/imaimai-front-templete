import { describe, expect, it } from "vitest";
import {
  avatarExtensionForMime,
  isOwnAvatarKey,
  isValidAvatarKey,
} from "./avatar-validation";

describe("avatarExtensionForMime", () => {
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

describe("isValidAvatarKey", () => {
  it.each([
    "user-123/avatar.png",
    "aB0_-x/avatar.jpg",
    "u/avatar.webp",
    "u/avatar.gif",
  ])("accepts well-formed key %s", (key) => {
    expect(isValidAvatarKey(key)).toBe(true);
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
    ["uppercase extension", "user-123/avatar.PNG"],
  ])("rejects %s: %j", (_label, key) => {
    expect(isValidAvatarKey(key)).toBe(false);
  });
});

describe("isOwnAvatarKey", () => {
  it("should accept the key when it is well-formed and owned by the caller", () => {
    expect(isOwnAvatarKey("user-123/avatar.png", "user-123")).toBe(true);
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
    expect(isOwnAvatarKey(key, userId)).toBe(false);
  });
});
