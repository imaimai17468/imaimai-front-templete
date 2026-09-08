#!/usr/bin/env bun

/**
 * The commands an orchestrating session runs while and after its workers work.
 * `.claude/settings.json` allowlists this file, so the session reaches GitHub
 * and git through these three commands instead of running `gh` and `git` of its
 * own, which that file does not allowlist.
 *
 * ```
 * bun scripts/orchestrate.ts free-gib          # free memory in GiB, one number
 * bun scripts/orchestrate.ts watch-prs feat/a feat/b       # exits when one of these needs the orchestrator
 * bun scripts/orchestrate.ts clean-worktrees feat/a feat/b # removes the worktrees of these finished branches
 * ```
 *
 * Both commands name the run by the branches the session assigned at dispatch,
 * which is what it knows before a worker has opened a pull request.
 *
 * `watch-prs` resolves each branch's pull request with `gh pr list --head` once
 * a minute and exits with a single line: `conflict <branch> ...` when an open
 * pull request of the run turns CONFLICTING, `all-closed` once no branch of the
 * run is waiting on one, or `gh-failed <message>` when `gh` itself failed. Run
 * it in the background and start it again after acting on the line.
 *
 * `clean-worktrees` prints one line per agent worktree saying whether it was
 * removed or why it was kept. It removes only the worktrees of the branches
 * given.
 */

import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  agentWorktrees,
  ancestryKeepReason,
  branchNames,
  formatBranch,
  formatEvent,
  formatVerdict,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  localVerdict,
  prListing,
  strandedAgentBranches,
  watchEvent,
  worktreeProbe,
  worktreeVerdict,
} from "./orchestrate-decisions";
import type {
  Ancestry,
  PullRequest,
  Worktree,
  WorktreeFacts,
  WorktreeVerdict,
} from "./orchestrate-decisions";

const POLL_MS = 60_000;

const run = (file: string, args: readonly string[]): string =>
  execFileSync(file, args, { encoding: "utf-8" });

const firstLine = (value: unknown): string =>
  (value instanceof Error ? value.message : String(value)).split("\n")[0] ?? "";

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

/**
 * What the failing command printed. `execFileSync`'s own message opens with
 * `Command failed:` and the command line, and puts the command's stderr on the
 * lines after it, so `firstLine` of that message hands back the command line
 * alone.
 */
const commandMessage = (error: unknown): string =>
  isCommandFailure(error) && error.stderr.trim() !== ""
    ? firstLine(error.stderr.trim())
    : firstLine(error);

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
      "headRefOid,mergeable,state",
    ])
  );
  const listing = prListing(parsed);
  if (listing.kind === "unreadable") {
    throw new Error(
      `gh pr list --head ${branch} returned a shape without headRefOid/mergeable/state`
    );
  }
  return listing.kind === "none" ? undefined : listing.pullRequest;
};

/**
 * The branch's pull request. An open one is asked for on its own, because a
 * branch whose open pull request was reopened long ago can sit behind any
 * number of newer finished ones in a single listing.
 */
const prOf = (branch: string): PullRequest | undefined =>
  branchPr(branch, "open") ?? branchPr(branch, "all");

/**
 * One poll's line and exit code, or undefined while the run needs no attention.
 * The pull requests stay inside this call, so the `watchPrs` frame awaiting the
 * next poll holds the branch names alone however long the run lasts.
 */
interface PollResult {
  readonly exitCode: number;
  readonly line: string;
}

const pollResult = (branches: readonly string[]): PollResult | undefined => {
  try {
    const event = watchEvent(
      branches.map((branch) => ({ branch, pullRequest: prOf(branch) }))
    );
    return event === undefined
      ? undefined
      : { exitCode: 0, line: formatEvent(event) };
  } catch (error) {
    return { exitCode: 1, line: `gh-failed ${commandMessage(error)}` };
  }
};

const watchPrs = async (branches: readonly string[]): Promise<void> => {
  const result = pollResult(branches);
  if (result !== undefined) {
    console.log(result.line);
    process.exitCode = result.exitCode;
    return;
  }
  await delay(POLL_MS);
  await watchPrs(branches);
};

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
    return { kind: "branch-kept", reason: commandMessage(error) };
  }
  return { kind: "remove" };
};

/**
 * Both commands below exit 1 to answer no: `rev-parse --verify --quiet` for a
 * commit it cannot resolve, and silently, where a broken repository gives it
 * 128 and a message; `merge-base --is-ancestor` for a commit outside the
 * history it was given.
 */
const ANSWERED_NO_STATUS = 1;

/**
 * Whether `commit` is in the history of `descendant`, or `descendant` is a
 * commit this repository does not have. Resolving it comes first, because
 * `merge-base` exits 128 both for a commit it cannot find and for a command
 * that broke, and the commit GitHub reports for a merged pull request is one
 * nothing local ever fetched whenever the remote branch is gone.
 */
const ancestry = (commit: string, descendant: string): Ancestry => {
  try {
    run("git", ["rev-parse", "--verify", "--quiet", `${descendant}^{commit}`]);
  } catch (error) {
    return isCommandFailure(error) && error.status === ANSWERED_NO_STATUS
      ? { commit: descendant, kind: "absent" }
      : { kind: "failed", reason: commandMessage(error) };
  }
  try {
    run("git", ["merge-base", "--is-ancestor", commit, descendant]);
    return { kind: "ancestor" };
  } catch (error) {
    return isCommandFailure(error) && error.status === ANSWERED_NO_STATUS
      ? { kind: "not-ancestor" }
      : { kind: "failed", reason: commandMessage(error) };
  }
};

/**
 * What `worktreeVerdict` judges. The ancestry runs on the branch, which is the
 * commit the worktree has checked out and the ref `removeWorktree` deletes.
 */
const worktreeFacts = (branch: string): WorktreeFacts => {
  const pullRequest = prOf(branch);
  return pullRequest === undefined
    ? { kind: "no-pull-request", mainAncestry: ancestry(branch, "main") }
    : {
        kind: "pull-request",
        pullRequest,
        pullRequestAncestry: ancestry(branch, pullRequest.headRefOid),
      };
};

/**
 * The verdict, after acting on it. A failure anywhere becomes a `keep` naming
 * what failed, so one unreachable pull request or one worktree git refuses to
 * remove leaves the rest of the list examined and reported.
 */
const verdictFor = (
  worktree: Worktree,
  branches: readonly string[]
): WorktreeVerdict => {
  const probe = worktreeProbe(worktree, branches);
  if (probe.kind === "verdict") {
    return probe.verdict;
  }
  try {
    const local = localVerdict(isDirty(worktree.path));
    if (local !== undefined) {
      return local;
    }
    const verdict = worktreeVerdict(worktreeFacts(probe.branch));
    return verdict.kind === "remove"
      ? removeWorktree(worktree, probe.branch)
      : verdict;
  } catch (error) {
    return { kind: "keep", reason: `failed: ${commandMessage(error)}` };
  }
};

/**
 * Deletes the branch once main holds its commits, and returns why it did not.
 * Main is named, where `git branch -d` would check the branch against its
 * upstream, or against HEAD when it has none.
 */
const deleteMergedBranch = (branch: string): string | undefined => {
  const reason = ancestryKeepReason(ancestry(branch, "main"), "main");
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

const cleanWorktrees = (branches: readonly string[]): void => {
  const worktrees = agentWorktrees(
    run("git", ["worktree", "list", "--porcelain"])
  );
  worktrees.forEach((worktree) => {
    console.log(formatVerdict(worktree, verdictFor(worktree, branches)));
  });
  const remaining = agentWorktrees(
    run("git", ["worktree", "list", "--porcelain"])
  );
  const names = run("git", [
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/",
  ])
    .split("\n")
    .filter((line) => line !== "");
  strandedAgentBranches(names, remaining).forEach((branch) => {
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
  const branches = branchNames(rest);
  if (branches === undefined) {
    usage("usage: bun scripts/orchestrate.ts watch-prs <branch>...");
  }
  await watchPrs(branches);
} else if (command === "clean-worktrees") {
  const branches = branchNames(rest);
  if (branches === undefined) {
    usage("usage: bun scripts/orchestrate.ts clean-worktrees <branch>...");
  }
  cleanWorktrees(branches);
} else {
  usage(
    "usage: bun scripts/orchestrate.ts <free-gib | watch-prs <branch>... | clean-worktrees <branch>...>"
  );
}
