import { describe, expect, it } from "vite-plus/test";
import {
  UpdateAvatarSchema,
  UpdateUserSchema,
  UserSchema,
  UserWithEmailSchema,
} from "./index";

// Exemplar white-box tests (AGENTS.md "Testing"): every exported schema is
// exercised on both outcomes of each refinement — boundary values of the
// length constraints and the exact user-facing messages included.

describe("UpdateUserSchema parsing", () => {
  it("should accept the name when it has the minimum length of 1", () => {
    expect(UpdateUserSchema.safeParse({ name: "a" }).success).toBeTruthy();
  });

  it("should accept the name when it has the maximum length of 50", () => {
    expect(
      UpdateUserSchema.safeParse({ name: "a".repeat(50) }).success
    ).toBeTruthy();
  });

  it("should return the required message when the name is empty", () => {
    const result = UpdateUserSchema.safeParse({ name: "" });
    expect(result.error?.issues[0]?.message).toBe("Name is required");
  });

  it("should return the length message when the name has 51 characters", () => {
    const result = UpdateUserSchema.safeParse({ name: "a".repeat(51) });
    expect(result.error?.issues[0]?.message).toBe(
      "Name must be 50 characters or less"
    );
  });
});

const base = {
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  id: "user_1",
  name: null,
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("UserSchema parsing", () => {
  it("should accept a user when nullable fields are null", () => {
    expect(UserSchema.safeParse(base).success).toBeTruthy();
  });

  it("should reject the user when a required field is missing", () => {
    const { id: _id, ...withoutId } = base;
    expect(UserSchema.safeParse(withoutId).success).toBeFalsy();
  });
});

describe("UserWithEmailSchema parsing", () => {
  it("should accept the user when the email is well-formed", () => {
    expect(
      UserWithEmailSchema.safeParse({ ...base, email: "a@example.com" }).success
    ).toBeTruthy();
  });

  it("should reject the user when the email is malformed", () => {
    expect(
      UserWithEmailSchema.safeParse({ ...base, email: "not-an-email" }).success
    ).toBeFalsy();
  });
});

describe("UpdateAvatarSchema parsing", () => {
  it("should accept the payload when avatarUrl is a valid URL", () => {
    expect(
      UpdateAvatarSchema.safeParse({ avatarUrl: "https://example.com/a.png" })
        .success
    ).toBeTruthy();
  });

  it("should reject the payload when avatarUrl is not a URL", () => {
    expect(
      UpdateAvatarSchema.safeParse({ avatarUrl: "not-a-url" }).success
    ).toBeFalsy();
  });
});
