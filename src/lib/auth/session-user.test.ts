import { describe, expect, it } from "vite-plus/test";
import { pickUser } from "./session-user";

describe(pickUser, () => {
  it("should return the user when the session carries one", () => {
    // Arrange
    const session = { user: { id: "user-id" } };

    // Act
    const user = pickUser(session);

    // Assert
    expect(user).toStrictEqual({ id: "user-id" });
  });

  it("should return null when the session is absent", () => {
    // Arrange
    const session = null;

    // Act
    const user = pickUser(session);

    // Assert
    expect(user).toBeNull();
  });

  it("should return null when the session carries no user", () => {
    // Arrange
    const session = { user: null };

    // Act
    const user = pickUser(session);

    // Assert
    expect(user).toBeNull();
  });
});
