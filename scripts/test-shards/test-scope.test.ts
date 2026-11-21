// @vitest-environment node

import { describe, expect, it } from "vite-plus/test";
import { decideTestScope, testScopeArgs } from "./test-scope";

describe(decideTestScope, () => {
  it("should run only the reached tests when no changed path is a trigger", () => {
    expect(
      decideTestScope(["src/lib/utils.ts", "README.md"], "HEAD^1")
    ).toStrictEqual({ kind: "changed", since: "HEAD^1" });
  });

  it.each([
    "bun.lock",
    "package.json",
    "vite.config.ts",
    "scripts/setup/setup.sh",
    ".github/workflows/ci.yaml",
  ])("should run the whole suite when %s changed", (trigger) => {
    expect(
      decideTestScope(["src/lib/utils.ts", trigger], "HEAD^1")
    ).toStrictEqual({ kind: "whole", trigger });
  });

  it("should run only the reached tests when nothing changed", () => {
    expect(decideTestScope([], "HEAD^1")).toStrictEqual({
      kind: "changed",
      since: "HEAD^1",
    });
  });
});

describe(testScopeArgs, () => {
  it("should add no flag when the whole suite runs", () => {
    expect(testScopeArgs({ kind: "whole", trigger: "bun.lock" })).toStrictEqual(
      {
        merge: "",
        shard: "",
        summary: "bun.lock changed, so every test runs.",
      }
    );
  });

  it("should narrow both jobs to the diff when only reached tests run", () => {
    expect(testScopeArgs({ kind: "changed", since: "HEAD^1" })).toStrictEqual({
      merge: "--coverage.changed=HEAD^1 --passWithNoTests",
      shard: "--changed=HEAD^1 --passWithNoTests",
      summary: "Only the tests the diff since HEAD^1 reaches run.",
    });
  });
});
