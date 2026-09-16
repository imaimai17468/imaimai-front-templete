import { DateTime, Option, Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  displayName,
  UpdateAvatarSchema,
  UpdateUserSchema,
  UserSchema,
  UserWithEmailSchema,
} from "./index";

// Exemplar white-box tests (AGENTS.md "Testing"): every exported schema is
// exercised on both outcomes of each check — boundary values of the length
// constraints and the exact user-facing messages included.

// The Standard Schema contract lets `validate` answer with the result or with
// a Promise of it, and this resolves both arms the way react-hook-form's
// resolver does.
const validateUpdateUser = (input: { readonly name: string }) =>
  globalThis.Promise.resolve(UpdateUserSchema["~standard"].validate(input));

const decodeUser = Schema.decodeUnknownResult(UserSchema);
const decodeUserWithEmail = Schema.decodeUnknownResult(UserWithEmailSchema);
const decodeUpdateAvatar = Schema.decodeUnknownResult(UpdateAvatarSchema);

// The form reaches this schema through its Standard Schema view, so these
// tests read the result back the way react-hook-form's resolver does.
describe("UpdateUserSchema Standard Schema validation", () => {
  it("should accept the name when it has the minimum length of 1", () =>
    validateUpdateUser({ name: "a" }).then((result) => {
      expect(result).toStrictEqual({ value: { name: "a" } });
    }));

  it("should accept the name when it has the maximum length of 50", () => {
    const name = "a".repeat(50);

    return validateUpdateUser({ name }).then((result) => {
      expect(result).toStrictEqual({ value: { name } });
    });
  });

  it("should return the required message when the name is empty", () =>
    validateUpdateUser({ name: "" }).then((result) => {
      expect(result).toStrictEqual({
        issues: [{ message: "Name is required", path: ["name"] }],
      });
    }));

  it("should return the length message when the name has 51 characters", () =>
    validateUpdateUser({
      name: "a".repeat(51),
    }).then((result) => {
      expect(result).toStrictEqual({
        issues: [
          { message: "Name must be 50 characters or less", path: ["name"] },
        ],
      });
    }));
});

// `effect/noNullish` reports a written `null`, and these two are the encoded
// side of the schema, which stays nullable so the value survives JSON.
const ABSENT_FIELD = Option.getOrNull(Option.none<string>());

const base = {
  avatarUrl: ABSENT_FIELD,
  createdAt: "2026-01-01T00:00:00Z",
  id: "user_1",
  name: ABSENT_FIELD,
  updatedAt: "2026-01-02T00:00:00Z",
};

describe("UserSchema decoding", () => {
  it("should turn both instants into DateTime.Utc when the payload is well-formed", () => {
    const result = decodeUser(base);

    expect(result).toStrictEqual(
      Result.succeed({
        avatarUrl: Option.none(),
        createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
        id: "user_1",
        name: Option.none(),
        updatedAt: DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"),
      })
    );
  });

  it("should reject the user when a required field is missing", () => {
    const { id: _id, ...withoutId } = base;

    const result = decodeUser(withoutId);

    expect(Result.isFailure(result)).toBeTruthy();
  });

  it("should reject the user when createdAt is not a date", () => {
    const result = decodeUser({ ...base, createdAt: "not-a-date" });

    expect(Result.isFailure(result)).toBeTruthy();
  });

  it("should reject the user when updatedAt is not a date", () => {
    const result = decodeUser({ ...base, updatedAt: "not-a-date" });

    expect(Result.isFailure(result)).toBeTruthy();
  });
});

describe("UserWithEmailSchema decoding", () => {
  it("should carry the email alongside both instants when the email is well-formed", () => {
    const result = decodeUserWithEmail({ ...base, email: "a@example.com" });

    expect(result).toStrictEqual(
      Result.succeed({
        avatarUrl: Option.none(),
        createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
        email: "a@example.com",
        id: "user_1",
        name: Option.none(),
        updatedAt: DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"),
      })
    );
  });

  it("should reject the user when the email is malformed", () => {
    const result = decodeUserWithEmail({ ...base, email: "not-an-email" });

    expect(Result.isFailure(result)).toBeTruthy();
  });
});

describe(displayName, () => {
  it("should fall back to User when the row holds no name", () => {
    const result = displayName(Option.none());

    expect(result).toBe("User");
  });

  it("should fall back to User when the name was cleared to an empty string", () => {
    const result = displayName(Option.some(""));

    expect(result).toBe("User");
  });

  it("should return the name when the row holds one", () => {
    const result = displayName(Option.some("Alice"));

    expect(result).toBe("Alice");
  });
});

describe("UpdateAvatarSchema decoding", () => {
  it("should turn avatarUrl into a URL when the payload holds an absolute one", () => {
    const result = decodeUpdateAvatar({
      avatarUrl: "https://example.com/a.png",
    });

    expect(result).toStrictEqual(
      Result.succeed({ avatarUrl: new URL("https://example.com/a.png") })
    );
  });

  it("should reject the payload when avatarUrl is not a URL", () => {
    const result = decodeUpdateAvatar({ avatarUrl: "not-a-url" });

    expect(Result.isFailure(result)).toBeTruthy();
  });
});
