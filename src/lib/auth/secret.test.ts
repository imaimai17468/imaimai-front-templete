import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { requireAuthSecret } from "./secret";
import type { AuthSecretName } from "./secret";

const secretNames = [
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] satisfies AuthSecretName[];

const notSetMessage = (name: AuthSecretName) =>
  `${name} is not set. Set it in the environment \`bun run deploy\` runs in for a deployed Worker, or in .env.local for local development.`;

describe(requireAuthSecret, () => {
  it.each(secretNames)(
    "should return the value when %s is configured",
    (name) => {
      expect(requireAuthSecret(name, Option.some("configured-value"))).toBe(
        "configured-value"
      );
    }
  );

  it.each(secretNames)("should throw when %s is absent", (name) => {
    expect(() => requireAuthSecret(name, Option.none())).toThrow(
      notSetMessage(name)
    );
  });

  it.each(secretNames)(
    "should throw when %s is set to an empty string",
    (name) => {
      expect(() => requireAuthSecret(name, Option.some(""))).toThrow(
        notSetMessage(name)
      );
    }
  );
});
