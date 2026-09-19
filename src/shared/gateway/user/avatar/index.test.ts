import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { avatarObjectFrom } from ".";

const body = new ReadableStream();

describe(avatarObjectFrom, () => {
  it("should carry the stored content type when R2 reports one", () => {
    // Arrange
    const stored = { body, httpMetadata: { contentType: "image/png" } };

    // Act
    const avatar = avatarObjectFrom(stored);

    // Assert
    expect(avatar).toStrictEqual({
      body,
      contentType: Option.some("image/png"),
    });
  });

  it("should report an absent content type when R2 carries no metadata", () => {
    // Arrange
    const stored = { body };

    // Act
    const avatar = avatarObjectFrom(stored);

    // Assert
    expect(avatar).toStrictEqual({ body, contentType: Option.none() });
  });

  it("should report an absent content type when the metadata omits it", () => {
    // Arrange
    const stored = { body, httpMetadata: {} };

    // Act
    const avatar = avatarObjectFrom(stored);

    // Assert
    expect(avatar).toStrictEqual({ body, contentType: Option.none() });
  });
});
