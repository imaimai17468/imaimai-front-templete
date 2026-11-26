import { describe, expect, it } from "vite-plus/test";
import { avatarUrlForKey } from "./avatar-url.ts";

describe(avatarUrlForKey, () => {
  it("should address the avatar route with the key percent-encoded into the query when the key holds slashes", () => {
    expect(avatarUrlForKey("user-1/avatars/0189ab/cd.png")).toBe(
      "/api/avatars?key=user-1%2Favatars%2F0189ab%2Fcd.png"
    );
  });
});
