import { describe, expect, it } from "vite-plus/test";
import { avatarKeyFromUrl, avatarUrlForKey } from "./avatar-url";

describe(avatarUrlForKey, () => {
  it("should percent-encode the key into the query string when the key holds slashes", () => {
    expect(
      avatarUrlForKey(
        "user-1/avatars/123e4567-e89b-42d3-a456-426614174000.webp"
      )
    ).toBe(
      "/api/avatars?key=user-1%2Favatars%2F123e4567-e89b-42d3-a456-426614174000.webp"
    );
  });
});

describe(avatarKeyFromUrl, () => {
  it.each([
    ["legacy key", "user-1/avatar.png"],
    [
      "versioned key",
      "user-1/avatars/123e4567-e89b-42d3-a456-426614174000.webp",
    ],
  ])(
    "should return the owned %s when the URL is one this module built",
    (_label, key) => {
      expect(avatarKeyFromUrl(avatarUrlForKey(key), "user-1")).toBe(key);
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
