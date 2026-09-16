import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { pickUser } from "./session-user";

// `effect/noNullish` reports a written `null`, so an absent user is built from
// a `None` rather than spelled out.
const ABSENT_USER = Option.getOrNull(Option.none<{ id: string }>());

describe(pickUser, () => {
  it("should return the user when the session carries one", () => {
    // Arrange
    const session = Option.some({ user: { id: "user-id" } });

    // Act
    const user = pickUser(session);

    // Assert
    expect(user).toStrictEqual(Option.some({ id: "user-id" }));
  });

  it("should return none when the session is absent", () => {
    // Arrange
    const session = Option.none<{ user: { id: string } }>();

    // Act
    const user = pickUser(session);

    // Assert
    expect(user).toStrictEqual(Option.none());
  });

  it("should return none when the session carries no user", () => {
    // Arrange
    const session = Option.some({ user: ABSENT_USER });

    // Act
    const user = pickUser(session);

    // Assert
    expect(user).toStrictEqual(Option.none());
  });
});
