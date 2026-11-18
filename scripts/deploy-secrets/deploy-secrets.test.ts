// @vitest-environment node

import { describe, expect, it } from "vite-plus/test";
import { secretsFromDevFile } from "./deploy-secrets";

const devFile = {
  BETTER_AUTH_SECRET: "your_better_auth_secret",
  GOOGLE_CLIENT_ID: "your_google_client_id",
  GOOGLE_CLIENT_SECRET: "your_google_client_secret",
};

describe(secretsFromDevFile, () => {
  it("should name every secret when each value came from the development file", () => {
    const result = secretsFromDevFile(devFile, devFile);

    expect(result).toStrictEqual([
      "BETTER_AUTH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ]);
  });

  it("should name nothing when the shell exported values the file does not hold", () => {
    const env = {
      BETTER_AUTH_SECRET: "production-secret",
      GOOGLE_CLIENT_ID: "production-client-id",
      GOOGLE_CLIENT_SECRET: "production-client-secret",
    };

    const result = secretsFromDevFile(env, devFile);

    expect(result).toStrictEqual([]);
  });

  it("should name nothing when the environment leaves every secret unset", () => {
    const result = secretsFromDevFile({}, devFile);

    expect(result).toStrictEqual([]);
  });
});
