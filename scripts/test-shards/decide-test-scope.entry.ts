#!/usr/bin/env bun

/**
 * ```
 * bun scripts/test-shards/decide-test-scope.entry.ts <since>
 * ```
 *
 * Lists the paths changed since `<since>`, decides the test scope, and writes
 * `shard-args` and `merge-args` to `$GITHUB_OUTPUT`.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { decideTestScope, testScopeArgs } from "./test-scope.ts";

const [since] = process.argv.slice(2);
const output = process.env.GITHUB_OUTPUT;

if (since === undefined || output === undefined) {
  console.error(
    "usage: GITHUB_OUTPUT=<file> decide-test-scope.entry.ts <since>"
  );
  process.exit(1);
}

const diff = spawnSync(
  "git",
  ["diff", "--name-only", "-z", `${since}...HEAD`],
  { encoding: "utf-8" }
);

if (diff.status !== 0) {
  console.error(`git diff failed: ${diff.stderr}`);
  process.exit(1);
}

const args = testScopeArgs(
  decideTestScope(diff.stdout.split("\0").filter(Boolean), since)
);

console.log(args.summary);
appendFileSync(output, `shard-args=${args.shard}\nmerge-args=${args.merge}\n`);
