#!/usr/bin/env bun

/**
 * The two reads an orchestrating session makes while its workers run, so the
 * session itself never issues a command that could stop on a permission prompt.
 *
 * ```
 * bun scripts/orchestrate.ts free-gib          # free memory in GiB, one number
 * bun scripts/orchestrate.ts watch-prs 12 15   # exits when one of these needs the orchestrator
 * bun scripts/orchestrate.ts clean-worktrees   # removes the worktrees of finished workers
 * ```
 *
 * `watch-prs` reads each PR with `gh pr view` once a minute and exits with a
 * single line: `conflict <n> ...` when an open PR of the run turns CONFLICTING,
 * `all-closed` once none of them is open, or `gh-failed <message>` when `gh`
 * itself failed. Run it in the background and start it again after acting on
 * the line.
 *
 * `clean-worktrees` prints one line per agent worktree saying whether it was
 * removed or why it was kept.
 */

import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  agentWorktrees,
  formatEvent,
  formatVerdict,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  prNumbers,
  watchEvent,
  worktreeVerdict,
} from "./orchestrate-decisions";
import type { PrRow, Worktree } from "./orchestrate-decisions";

const POLL_MS = 60_000;

const run = (file: string, args: readonly string[]): string =>
  execFileSync(file, args, { encoding: "utf-8" });

/**
 * Undefined covers both ways the platform can withhold the number: a command
 * that is absent (a Linux image without procps) throws, and one that runs but
 * prints a shape the parser does not recognise returns undefined.
 */
const freeGib = (): number | undefined => {
  try {
    if (process.platform === "darwin") {
      return freeGibFromMemoryPressure(
        run("memory_pressure", []),
        Number(run("sysctl", ["-n", "hw.memsize"]).trim())
      );
    }
    return freeGibFromFreeB(run("free", ["-b"]));
  } catch {
    return undefined;
  }
};

const isPrRow = (value: unknown): value is PrRow =>
  typeof value === "object" &&
  value !== null &&
  "number" in value &&
  typeof value.number === "number" &&
  "state" in value &&
  typeof value.state === "string" &&
  "mergeable" in value &&
  typeof value.mergeable === "string";

const prRow = (number: number): PrRow => {
  const parsed: unknown = JSON.parse(
    run("gh", [
      "pr",
      "view",
      String(number),
      "--json",
      "number,state,mergeable",
    ])
  );
  if (!isPrRow(parsed)) {
    throw new Error(
      `gh pr view ${number} returned a shape without number/state/mergeable`
    );
  }
  return parsed;
};

const ghFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

/**
 * One poll's line and exit code, or undefined while the run needs no attention.
 * The rows stay inside this call, so the `watchPrs` frame awaiting the next
 * poll holds the PR numbers alone however long the run lasts.
 */
interface PollResult {
  readonly exitCode: number;
  readonly line: string;
}

const pollResult = (numbers: readonly number[]): PollResult | undefined => {
  try {
    const event = watchEvent(numbers, numbers.map(prRow));
    return event === undefined
      ? undefined
      : { exitCode: 0, line: formatEvent(event) };
  } catch (error) {
    return { exitCode: 1, line: `gh-failed ${ghFailure(error)}` };
  }
};

const watchPrs = async (numbers: readonly number[]): Promise<void> => {
  const result = pollResult(numbers);
  if (result !== undefined) {
    console.log(result.line);
    process.exitCode = result.exitCode;
    return;
  }
  await delay(POLL_MS);
  await watchPrs(numbers);
};

interface PrStateRow {
  readonly state: string;
}

const isPrStateRow = (value: unknown): value is PrStateRow =>
  typeof value === "object" &&
  value !== null &&
  "state" in value &&
  typeof value.state === "string";

const prStateOf = (branch: string): string | undefined => {
  const parsed: unknown = JSON.parse(
    run("gh", [
      "pr",
      "list",
      "--state",
      "all",
      "--head",
      branch,
      "--limit",
      "1",
      "--json",
      "state",
    ])
  );
  const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
  return isPrStateRow(first) ? first.state : undefined;
};

const isDirty = (path: string): boolean =>
  run("git", ["-C", path, "status", "--porcelain"]).trim() !== "";

const removeWorktree = (worktree: Worktree): void => {
  if (worktree.locked) {
    run("git", ["worktree", "unlock", worktree.path]);
  }
  run("git", ["worktree", "remove", worktree.path]);
  if (worktree.branch !== undefined) {
    run("git", ["branch", "-D", worktree.branch]);
  }
};

const cleanWorktrees = (): void => {
  const worktrees = agentWorktrees(
    run("git", ["worktree", "list", "--porcelain"])
  );
  worktrees.forEach((worktree) => {
    const verdict = worktreeVerdict(
      worktree,
      isDirty(worktree.path),
      worktree.branch === undefined ? undefined : prStateOf(worktree.branch)
    );
    if (verdict.kind === "remove") {
      removeWorktree(worktree);
    }
    console.log(formatVerdict(worktree, verdict));
  });
};

const [command, ...rest] = process.argv.slice(2);

const usage: (line: string) => never = (line) => {
  console.error(line);
  process.exit(1);
};

if (command === "free-gib") {
  const gib = freeGib();
  if (gib === undefined) {
    usage("could not read free memory from the platform command");
  }
  console.log(gib.toFixed(1));
} else if (command === "watch-prs") {
  const numbers = prNumbers(rest);
  if (numbers === undefined) {
    usage("usage: bun scripts/orchestrate.ts watch-prs <pr-number>...");
  }
  await watchPrs(numbers);
} else if (command === "clean-worktrees") {
  cleanWorktrees();
} else {
  usage(
    "usage: bun scripts/orchestrate.ts <free-gib | watch-prs <pr-number>... | clean-worktrees>"
  );
}
