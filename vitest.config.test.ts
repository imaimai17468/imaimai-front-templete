// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { coverageExclude } from "./vitest.config.mts";

const ROOT = import.meta.dirname;

// tinyglobby with `dot` and `onlyFiles` is what vitest expands these patterns
// with, so a pattern that selects only a directory, and one that selects only
// a dotted path, are counted here the way the coverage gate counts them.
const stalePatterns = (patterns: readonly string[], root: string): string[] =>
  patterns.filter(
    (pattern) =>
      globSync(pattern, { cwd: root, dot: true, onlyFiles: true }).length === 0
  );

/**
 * A tree holding one module, so a pattern that selects nothing here selects
 * nothing because its own target is absent rather than because the tree is
 * empty.
 */
const treeWithOneModule = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coverage-exclude-"));
  onTestFinished(() => {
    fs.rmSync(root, { force: true, recursive: true });
  });
  fs.mkdirSync(path.join(root, "src/lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/lib/live.ts"), "export const x = 1;\n");
  return root;
};

describe("coverage.exclude", () => {
  it("should report no stale entry when every entry selects a file in the working tree", () => {
    expect(stalePatterns(coverageExclude, ROOT)).toStrictEqual([]);
  });

  it.each(["src/lib/moved.ts", "src/moved/**"])(
    "should report %s as stale when it selects no file in the tree",
    (pattern) => {
      const root = treeWithOneModule();

      expect(stalePatterns([pattern], root)).toStrictEqual([pattern]);
    }
  );

  it("should report a pattern as stale when the directory it selects holds no file", () => {
    const root = treeWithOneModule();
    fs.mkdirSync(path.join(root, "src/empty"));

    expect(stalePatterns(["src/empty/**"], root)).toStrictEqual([
      "src/empty/**",
    ]);
  });
});
