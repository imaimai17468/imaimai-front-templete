#!/usr/bin/env bun

/**
 * The commands an orchestrating session runs while and after its workers work.
 * `.claude/settings.json` allowlists this file, so the session issues no command
 * that could stop it on a permission prompt.
 *
 * ```
 * bun scripts/orchestrate.ts free-gib          # free memory in GiB, one number
 * bun scripts/orchestrate.ts watch-prs 12 15   # exits when one of these needs the orchestrator
 * bun scripts/orchestrate.ts clean-worktrees 12 15  # removes the worktrees of these finished PRs
 * ```
 *
 * `watch-prs` reads each PR with `gh pr view` once a minute and exits with a
 * single line: `conflict <n> ...` when an open PR of the run turns CONFLICTING,
 * `all-closed` once none of them is open, or `gh-failed <message>` when `gh`
 * itself failed. Run it in the background and start it again after acting on
 * the line.
 *
 * `clean-worktrees` prints one line per agent worktree saying whether it was
 * removed or why it was kept. It touches only the worktrees whose pull request
 * is one of the numbers given.
 */

import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  agentWorktrees,
  formatEvent,
  branchKeepReason,
  formatBranch,
  formatVerdict,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  localVerdict,
  prNumbers,
  strandedAgentBranches,
  watchEvent,
  worktreeProbe,
  worktreeVerdict,
} from "./orchestrate-decisions";
import type {
  Ancestry,
  PrRow,
  PullRequest,
  Worktree,
  WorktreeVerdict,
} from "./orchestrate-decisions";

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

const firstLine = (value: unknown): string =>
  (value instanceof Error ? value.message : String(value)).split("\n")[0] ?? "";

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
    return { exitCode: 1, line: `gh-failed ${firstLine(error)}` };
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

const isPullRequest = (value: unknown): value is PullRequest =>
  typeof value === "object" &&
  value !== null &&
  "state" in value &&
  typeof value.state === "string" &&
  "number" in value &&
  typeof value.number === "number" &&
  "headRefOid" in value &&
  typeof value.headRefOid === "string";

const branchPr = (branch: string, state: string): PullRequest | undefined => {
  const parsed: unknown = JSON.parse(
    run("gh", [
      "pr",
      "list",
      "--state",
      state,
      "--head",
      branch,
      "--limit",
      "1",
      "--json",
      "headRefOid,number,state",
    ])
  );
  const first: unknown = Array.isArray(parsed) ? parsed[0] : undefined;
  return isPullRequest(first) ? first : undefined;
};

/**
 * The branch's pull request. An open one is asked for on its own, because a
 * branch whose open pull request was reopened long ago can sit behind any
 * number of newer finished ones in a single listing.
 */
const prOf = (branch: string): PullRequest | undefined =>
  branchPr(branch, "open") ?? branchPr(branch, "all");

const headSha = (path: string): string =>
  run("git", ["-C", path, "rev-parse", "HEAD"]).trim();

const isDirty = (path: string): boolean =>
  run("git", ["-C", path, "status", "--porcelain"]).trim() !== "";

const RELOCK_REASON = "clean-worktrees could not remove it";

/**
 * Removes the worktree, then its branch. The branch is a second step because a
 * removed directory cannot be reported as kept, so its own failure gets its own
 * verdict.
 */
const removeWorktree = (
  worktree: Worktree,
  branch: string
): WorktreeVerdict => {
  if (worktree.locked) {
    run("git", ["worktree", "unlock", worktree.path]);
  }
  try {
    run("git", ["worktree", "remove", worktree.path]);
  } catch (error) {
    if (worktree.locked) {
      run("git", [
        "worktree",
        "lock",
        "--reason",
        RELOCK_REASON,
        worktree.path,
      ]);
    }
    throw error;
  }
  try {
    run("git", ["branch", "-D", branch]);
  } catch (error) {
    return { kind: "branch-kept", reason: firstLine(error) };
  }
  return { kind: "remove" };
};

/**
 * The verdict, after acting on it. A failure anywhere becomes a `keep` naming
 * what failed, so one unreachable pull request or one worktree git refuses to
 * remove leaves the rest of the list examined and reported.
 */
const verdictFor = (
  worktree: Worktree,
  numbers: readonly number[]
): WorktreeVerdict => {
  const probe = worktreeProbe(worktree);
  if (probe.kind === "verdict") {
    return probe.verdict;
  }
  try {
    const local = localVerdict(isDirty(worktree.path));
    if (local !== undefined) {
      return local;
    }
    const verdict = worktreeVerdict(
      headSha(worktree.path),
      prOf(probe.branch),
      numbers
    );
    return verdict.kind === "remove"
      ? removeWorktree(worktree, probe.branch)
      : verdict;
  } catch (error) {
    return { kind: "keep", reason: `failed: ${firstLine(error)}` };
  }
};

interface CommandFailure {
  readonly status: number | null;
  readonly stderr: string;
}

const isCommandFailure = (value: unknown): value is CommandFailure =>
  typeof value === "object" &&
  value !== null &&
  "status" in value &&
  (typeof value.status === "number" || value.status === null) &&
  "stderr" in value &&
  typeof value.stderr === "string";

/** What the failing command printed, rather than the wrapper's own message. */
const commandMessage = (error: unknown): string =>
  isCommandFailure(error) && error.stderr.trim() !== ""
    ? firstLine(error.stderr.trim())
    : firstLine(error);

const NOT_ANCESTOR_STATUS = 1;

/**
 * Ancestry asked of main by name, where `git branch -d` would ask it of
 * whichever branch this session happens to have checked out.
 */
const ancestryOfMain = (branch: string): Ancestry => {
  try {
    run("git", ["merge-base", "--is-ancestor", branch, "main"]);
    return { kind: "ancestor" };
  } catch (error) {
    return isCommandFailure(error) && error.status === NOT_ANCESTOR_STATUS
      ? { kind: "not-ancestor" }
      : { kind: "failed", reason: commandMessage(error) };
  }
};

/** Deletes the branch once main holds its commits, and returns why it did not. */
const deleteMergedBranch = (branch: string): string | undefined => {
  const reason = branchKeepReason(ancestryOfMain(branch));
  if (reason !== undefined) {
    return reason;
  }
  try {
    run("git", ["branch", "-D", branch]);
    return undefined;
  } catch (error) {
    return commandMessage(error);
  }
};

const cleanWorktrees = (numbers: readonly number[]): void => {
  const worktrees = agentWorktrees(
    run("git", ["worktree", "list", "--porcelain"])
  );
  worktrees.forEach((worktree) => {
    console.log(formatVerdict(worktree, verdictFor(worktree, numbers)));
  });
  const held = agentWorktrees(
    run("git", ["worktree", "list", "--porcelain"])
  ).map((worktree) => worktree.branch);
  const names = run("git", [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/",
  ])
    .split("\n")
    .filter((line) => line !== "");
  strandedAgentBranches(names, held).forEach((branch) => {
    console.log(formatBranch(branch, deleteMergedBranch(branch)));
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
  const numbers = prNumbers(rest);
  if (numbers === undefined) {
    usage("usage: bun scripts/orchestrate.ts clean-worktrees <pr-number>...");
  }
  cleanWorktrees(numbers);
} else {
  usage(
    "usage: bun scripts/orchestrate.ts <free-gib | watch-prs <pr-number>... | clean-worktrees <pr-number>...>"
  );
}
