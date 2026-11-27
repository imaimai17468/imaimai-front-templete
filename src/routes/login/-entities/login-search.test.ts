import { describe, expect, it } from "vite-plus/test";
import { validateStandard } from "@/test/standard-schema";
import { LoginSearchSchema } from "./login-search.ts";

const validateLoginSearch = (search: { readonly error?: string | number }) =>
  validateStandard(LoginSearchSchema, search);

describe("the /login query", () => {
  it("should keep the failure code when Better Auth sends a failed sign-in back", () =>
    expect(
      validateLoginSearch({ error: "access_denied" })
    ).resolves.toStrictEqual({ value: { error: "access_denied" } }));

  it("should reject the query when its error is not a string", () =>
    expect(validateLoginSearch({ error: 403 })).resolves.toStrictEqual({
      issues: [{ message: "Expected string", path: ["error"] }],
    }));

  it("should read no failure when the query carries no error", () =>
    expect(validateLoginSearch({})).resolves.toStrictEqual({ value: {} }));
});
