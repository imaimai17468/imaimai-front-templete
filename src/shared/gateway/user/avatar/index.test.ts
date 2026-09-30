import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { AvatarObject, avatarObjectFrom } from ".";

const bodyOf = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

const served = (response: Response) =>
  response.text().then((body) => ({
    body,
    headers: Object.fromEntries(response.headers),
    status: response.status,
  }));

describe("AvatarObject.response", () => {
  it("should keep the image type, nosniff and a closed policy when the bytes read as HTML", () => {
    // Arrange
    const avatar = new AvatarObject(bodyOf("<html>"), "image/png");

    // Act
    const received = served(avatar.response());

    // Assert
    return expect(received).resolves.toStrictEqual({
      body: "<html>",
      headers: {
        "cache-control": "private, max-age=31536000, immutable",
        "content-security-policy": "default-src 'none'",
        "content-type": "image/png",
        "x-content-type-options": "nosniff",
      },
      status: 200,
    });
  });
});

describe(avatarObjectFrom, () => {
  it.each([
    ["user-1/avatars/123e4567-e89b-42d3-a456-426614174000.webp", "image/webp"],
    ["user-1/avatar.JPEG", "image/jpeg"],
  ])(
    "should serve the object as the type its key's extension names when the key is %s",
    (key, contentType) => {
      // Arrange
      const body = bodyOf("avatar");

      // Act
      const type = Option.map(avatarObjectFrom(key, body), (avatar) =>
        avatar.response().headers.get("Content-Type")
      );

      // Assert
      expect(type).toStrictEqual(Option.some(contentType));
    }
  );

  it.each(["user-1/avatar.html", "../user-1/avatar.png"])(
    "should serve nothing when the key %s names no avatar",
    (key) => {
      // Arrange
      const body = bodyOf("avatar");

      // Act
      const avatar = avatarObjectFrom(key, body);

      // Assert
      expect(avatar).toStrictEqual(Option.none());
    }
  );
});
