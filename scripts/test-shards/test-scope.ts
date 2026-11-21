/**
 * Decides how much of the test suite a pull request runs. `--changed` runs
 * only the test files whose imports reach a changed file, and coverage is then
 * judged only on the changed files. A change to a path below reaches every test
 * without being imported by any, so it runs and judges the whole suite.
 */

import path from "node:path";

/**
 * Written as Vitest matches `forceRerunTriggers`: against absolute paths, so
 * each pattern starts with `**` followed by a slash. The first two are Vitest's own defaults.
 * `scripts/setup/**` is here because its test reads those files from disk.
 */
export const WHOLE_SUITE_TRIGGERS = [
  "**/package.json",
  "**/{vitest,vite}.config.*",
  "**/bun.lock",
  "**/mise.toml",
  "**/tsconfig.json",
  "**/src/test/setup.ts",
  "**/scripts/setup/**",
  "**/scripts/test-shards/**",
  "**/.github/workflows/**",
  "**/.github/actions/**",
];

export type TestScope =
  | { readonly kind: "whole"; readonly trigger: string }
  | { readonly kind: "changed"; readonly since: string };

export const decideTestScope = (
  changedPaths: readonly string[],
  since: string
): TestScope => {
  const trigger = changedPaths.find((changed) =>
    WHOLE_SUITE_TRIGGERS.some((pattern) => path.matchesGlob(changed, pattern))
  );
  return trigger === undefined
    ? { kind: "changed", since }
    : { kind: "whole", trigger };
};

export interface TestScopeArgs {
  readonly merge: string;
  readonly shard: string;
  readonly summary: string;
}

/**
 * The flags each test job appends. A run that reaches no test file passes,
 * because a diff that touches no tested code has nothing to fail.
 */
export const testScopeArgs = (scope: TestScope): TestScopeArgs =>
  scope.kind === "whole"
    ? {
        merge: "",
        shard: "",
        summary: `${scope.trigger} changed, so every test runs.`,
      }
    : {
        merge: `--coverage.changed=${scope.since} --passWithNoTests`,
        shard: `--changed=${scope.since} --passWithNoTests`,
        summary: `Only the tests the diff since ${scope.since} reaches run.`,
      };
