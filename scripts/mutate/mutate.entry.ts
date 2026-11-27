#!/usr/bin/env bun

/**
 * ```
 * bun run mutate                       # every mutated tracked file
 * bun run mutate <file>... [--json]    # the mutated files among those
 * ```
 *
 * Runs Mootant on the files `mutation-targets.ts` picks, passing the flags
 * through, and exits with Mootant's exit code.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mutateCommand } from "./mutation-targets.ts";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf-8",
})
  .split("\0")
  .filter((file) => file !== "");

const command = mutateCommand(process.argv.slice(2), tracked);

if (command.kind === "nothing") {
  console.error(command.reason);
  process.exit(0);
}

const run = spawnSync("mootant", command.args, { cwd: root, stdio: "inherit" });
if (run.error !== undefined) {
  console.error(run.error.message);
}
process.exit(run.status ?? 1);
