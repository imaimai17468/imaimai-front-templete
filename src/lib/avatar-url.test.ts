import { describe, expect, it } from "vitest";
import { AVATAR_ROUTE_PATH, avatarUrlForKey } from "./avatar-url";

describe(avatarUrlForKey, () => {
  it("should percent-encode the key into the query when the key holds slashes", () => {
    expect(avatarUrlForKey("user-1/avatars/0189ab/cd.png")).toBe(
      `${AVATAR_ROUTE_PATH}?key=user-1%2Favatars%2F0189ab%2Fcd.png`
    );
  });
});
