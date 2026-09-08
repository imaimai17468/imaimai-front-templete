// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { coverageExclude } from "./vitest.config.mts";

const ROOT = import.meta.dirname;

// `globSync` takes a literal path and a wildcard pattern alike, and it reads
// the working tree, so a module written but not yet committed counts as
// present.
const stalePatterns = (patterns: readonly string[], root: string): string[] =>
  patterns.filter(
    (pattern) => fs.globSync(pattern, { cwd: root }).length === 0
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
});
