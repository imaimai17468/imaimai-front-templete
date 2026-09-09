#!/usr/bin/env bun

/**
 * The commands an orchestrating session runs while and after its workers work.
 * `.claude/settings.json` allowlists this file, so the session reaches GitHub
 * and git through these four commands instead of running `gh` and `git` of its
 * own, which that file does not allowlist.
 *
 * ```
 * bun scripts/orchestrate.ts free-gib          # free memory in GiB, one number
 * bun scripts/orchestrate.ts remaining-budget  # the account's usage windows, one line
 * bun scripts/orchestrate.ts watch-prs feat/a feat/b       # exits when one of these needs the orchestrator
 * bun scripts/orchestrate.ts clean-worktrees feat/a feat/b # removes the worktrees of these finished branches
 * ```
 *
 * `watch-prs` and `clean-worktrees` name the run by the branches the session
 * assigned at dispatch, which is what it knows before a worker has opened a
 * pull request.
 *
 * `remaining-budget` reads `~/.claude/rate-limits.json`, which a status line
 * outside this repository writes, and prints what each usage window has spent
 * and when it resets, or `unknown` and what stopped it.
 *
 * `watch-prs` resolves each branch's pull request with `gh pr list --head` once
 * a minute and exits with a single line: `conflict <branch> ...` when an open
 * pull request of the run turns CONFLICTING, `all-closed` once no branch of the
 * run is waiting on one, or `gh-failed <message>` when `gh` itself failed. Run
 * it in the background and start it again after acting on the line.
 *
 * `clean-worktrees` prints one line per agent worktree saying whether it was
 * removed or why it was kept. It removes only the worktrees of the branches
 * given, and it fetches MAIN_REF first, because whether a branch's commits are
 * held anywhere else is asked of that ref.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  agentWorktrees,
  ancestryAfterFetch,
  ancestryKeepReason,
  branchNames,
  MAIN_BRANCH,
  MAIN_REF,
  MAIN_REMOTE,
  formatBranch,
  formatEvent,
  formatRemainingBudget,
  formatVerdict,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  isRecord,
  localVerdict,
  prListing,
  remainingBudget,
  strandedAgentBranches,
  watchEvent,
  worktreeProbe,
  worktreeVerdict,
} from "./orchestrate-decisions";
import type {
  Ancestry,
  MainFetch,
  PullRequest,
  RateLimitsFile,
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
  isRecord(value) &&
  (typeof value.status === "number" || value.status === null) &&
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

/** The path `remaining-budget` reads, written from outside this repository. */
const RATE_LIMITS_PATH = path.join(homedir(), ".claude", "rate-limits.json");

const MS_PER_SECOND = 1000;

const FILE_NOT_FOUND = "ENOENT";

interface ErrnoFailure {
  readonly code: string;
}

const isErrnoFailure = (value: unknown): value is ErrnoFailure =>
  isRecord(value) && typeof value.code === "string";

/**
 * The file's text. A missing file is the one failure that answers `absent`, so
 * a permission or I/O error reaches the line as what the platform said about
 * it rather than as a status line that never wrote.
 */
const rateLimitsFile = (): RateLimitsFile => {
  try {
    return { kind: "content", text: readFileSync(RATE_LIMITS_PATH, "utf-8") };
  } catch (error) {
    return isErrnoFailure(error) && error.code === FILE_NOT_FOUND
      ? { kind: "absent" }
      : { detail: firstLine(error), kind: "unreadable" };
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

const isDirty = (worktreePath: string): boolean =>
  run("git", ["-C", worktreePath, "status", "--porcelain"]).trim() !== "";

/** What git printed when it refused to delete the branch, or undefined. */
const deleteBranch = (branch: string): string | undefined => {
  try {
    run("git", ["branch", "-D", branch]);
    return undefined;
  } catch (error) {
    return commandMessage(error);
  }
};

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
  const reason = deleteBranch(branch);
  return reason === undefined
    ? { kind: "remove" }
    : { kind: "branch-kept", reason };
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
 * Brings MAIN_REF up to what the remote holds. The refspec names the ref it
 * writes, and running the fetch once per `clean-worktrees` leaves every verdict
 * of that call reading the one it wrote.
 */
const fetchMain = (): MainFetch => {
  try {
    run("git", [
      "fetch",
      "--quiet",
      MAIN_REMOTE,
      `+refs/heads/${MAIN_BRANCH}:refs/remotes/${MAIN_REF}`,
    ]);
    return { kind: "fetched" };
  } catch (error) {
    return { kind: "failed", reason: commandMessage(error) };
  }
};

/** Where the branch sits in MAIN_REF's history, as this call's fetch left it. */
const mainRefAncestry = (branch: string, mainFetch: MainFetch): Ancestry =>
  ancestryAfterFetch(mainFetch, () => ancestry(branch, MAIN_REF));

/**
 * What `worktreeVerdict` judges. Every ancestry runs on the branch, which is
 * the commit the worktree has checked out and the ref `removeWorktree` deletes.
 * Comparing MAIN_REF runs on every worktree that reaches this call, including
 * one whose pull request settles the verdict on its own.
 */
const worktreeFacts = (branch: string, mainFetch: MainFetch): WorktreeFacts => {
  const pullRequest = prOf(branch);
  const mainAncestry = mainRefAncestry(branch, mainFetch);
  return pullRequest === undefined
    ? { kind: "no-pull-request", mainAncestry }
    : {
        kind: "pull-request",
        mainAncestry,
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
  branches: readonly string[],
  mainFetch: MainFetch
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
    const verdict = worktreeVerdict(worktreeFacts(probe.branch, mainFetch));
    return verdict.kind === "remove"
      ? removeWorktree(worktree, probe.branch)
      : verdict;
  } catch (error) {
    return { kind: "keep", reason: `failed: ${commandMessage(error)}` };
  }
};

/**
 * Deletes the branch once MAIN_REF holds its commits, and returns why it did
 * not. MAIN_REF is named, where `git branch -d` would check the branch against
 * its upstream, or against HEAD when it has none.
 */
const deleteMergedBranch = (
  branch: string,
  mainFetch: MainFetch
): string | undefined =>
  ancestryKeepReason(mainRefAncestry(branch, mainFetch), MAIN_REF) ??
  deleteBranch(branch);

const cleanWorktrees = (branches: readonly string[]): void => {
  const mainFetch = fetchMain();
  const worktrees = agentWorktrees(
    run("git", ["worktree", "list", "--porcelain"])
  );
  worktrees.forEach((worktree) => {
    console.log(
      formatVerdict(worktree, verdictFor(worktree, branches, mainFetch))
    );
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
    console.log(formatBranch(branch, deleteMergedBranch(branch, mainFetch)));
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
} else if (command === "remaining-budget") {
  console.log(
    formatRemainingBudget(
      remainingBudget(rateLimitsFile(), Date.now() / MS_PER_SECOND),
      RATE_LIMITS_PATH
    )
  );
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
    "usage: bun scripts/orchestrate.ts <free-gib | remaining-budget | watch-prs <branch>... | clean-worktrees <branch>...>"
  );
}
