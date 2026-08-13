import { describe, expect, it } from "vitest";
import { requireAuthSecret, type AuthSecretName } from "./required-secret";

const secretNames = [
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] satisfies AuthSecretName[];

describe("requireAuthSecret", () => {
  it.each(secretNames)(
    "should return the value when %s is configured",
    (name) => {
      expect(requireAuthSecret(name, "configured-value")).toBe(
        "configured-value"
      );
    }
  );

  it.each(
    secretNames.flatMap((name) => [
      [name, undefined],
      [name, ""],
    ])
  )("should throw when %s is missing", (name, value) => {
    expect(() => requireAuthSecret(name, value)).toThrow(
      `${name} is not set. Register it with \`wrangler secret put ${name}\` for a deployed Worker, or set it in .env.local for local development.`
    );
  });
});
