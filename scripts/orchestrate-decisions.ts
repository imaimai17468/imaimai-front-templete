/**
 * The decisions the orchestrating session makes between dispatches, kept free
 * of I/O so a test can reach each branch. `orchestrate.ts` feeds them what the
 * machine and `gh` report.
 */

const GIB = 1024 ** 3;

/**
 * macOS `memory_pressure` ends with "System-wide memory free percentage: 95%".
 * Returns undefined when that line is absent.
 */
export const freeGibFromMemoryPressure = (
  output: string,
  totalBytes: number
): number | undefined => {
  const match = /free percentage:\s*(?<percent>\d+)%/u.exec(output);
  if (match?.groups === undefined) {
    return undefined;
  }
  return (Number(match.groups.percent) / 100) * (totalBytes / GIB);
};

/**
 * Linux `free -b` prints a "Mem:" row whose seventh column is "available",
 * the memory a new process can take without swapping.
 */
export const freeGibFromFreeB = (output: string): number | undefined => {
  const row = output.split("\n").find((line) => line.startsWith("Mem:"));
  const available = row?.trim().split(/\s+/u)[6];
  if (available === undefined) {
    return undefined;
  }
  return Number(available) / GIB;
};

/**
 * The fields of `gh pr list --head <branch> --json headRefOid,mergeable,state`
 * both commands read. The watch reads `state` and `mergeable`, the cleanup
 * `state` and `headRefOid`.
 */
export interface PullRequest {
  readonly headRefOid: string;
  readonly mergeable: string;
  readonly state: string;
}

const isPullRequest = (value: unknown): value is PullRequest =>
  typeof value === "object" &&
  value !== null &&
  "headRefOid" in value &&
  typeof value.headRefOid === "string" &&
  "mergeable" in value &&
  typeof value.mergeable === "string" &&
  "state" in value &&
  typeof value.state === "string";

export type PrListing =
  | { readonly kind: "none" }
  | { readonly kind: "pull-request"; readonly pullRequest: PullRequest }
  | { readonly kind: "unreadable" };

/**
 * What one `gh pr list --head` reply says. An empty listing is the only answer
 * that means the branch has no pull request, and the watch waits on such a
 * branch as one whose worker has not opened one yet, so a reply this cannot
 * read is kept apart: that is `gh` answering something the caller has to see
 * rather than a branch to wait on.
 */
export const prListing = (parsed: unknown): PrListing => {
  if (!Array.isArray(parsed)) {
    return { kind: "unreadable" };
  }
  const first: unknown = parsed[0];
  if (first === undefined) {
    return { kind: "none" };
  }
  return isPullRequest(first)
    ? { kind: "pull-request", pullRequest: first }
    : { kind: "unreadable" };
};

/** A branch of the run and the pull request GitHub reports for it. */
export interface BranchPullRequest {
  readonly branch: string;
  readonly pullRequest: PullRequest | undefined;
}

export type WatchEvent =
  | { readonly kind: "all-closed" }
  | { readonly kind: "conflict"; readonly branches: readonly string[] };

/**
 * What the watch reports back, or undefined while nothing needs the
 * orchestrator. A branch whose pull request is undefined is one whose worker
 * has not opened it yet, and it holds the watch for the same reason an open
 * pull request does.
 */
export const watchEvent = (
  resolved: readonly BranchPullRequest[]
): WatchEvent | undefined => {
  const conflicting = resolved
    .filter(
      (entry) =>
        entry.pullRequest?.state === "OPEN" &&
        entry.pullRequest.mergeable === "CONFLICTING"
    )
    .map((entry) => entry.branch);
  if (conflicting.length > 0) {
    return { branches: conflicting, kind: "conflict" };
  }
  const waiting = resolved.filter(
    (entry) =>
      entry.pullRequest === undefined || entry.pullRequest.state === "OPEN"
  );
  return waiting.length === 0 ? { kind: "all-closed" } : undefined;
};

/** The one line the watch prints before exiting. */
export const formatEvent = (event: WatchEvent): string =>
  event.kind === "all-closed"
    ? "all-closed"
    : `conflict ${event.branches.join(" ")}`;

/**
 * A name that can carry a branch. `--head` takes the next argument as its value
 * whatever it starts with, so `gh pr list --state open --head -x` returns an
 * empty listing rather than an argument error, and a name no branch can carry
 * reads the same as a branch whose worker has not opened a pull request, which
 * the watch waits on for as long as it runs.
 */
const BRANCH_NAME = /^\w[\w./-]*(?<![./])$/u;

/**
 * The sequences `git check-ref-format --branch` rejects that BRANCH_NAME's own
 * characters allow. It exits 128 on `feat/a..b`, on `feat/.hidden` and on
 * `feat/a.lock`.
 */
const FORBIDDEN_IN_REF = /\.\.|\/\.|\.lock(?:\/|$)/u;

/**
 * These commands took pull request numbers before they took branches, and
 * `gh pr list --head 12` reports no pull request for a branch named `12`
 * rather than the argument that was wrong.
 */
const ALL_DIGITS = /^\d+$/u;

/**
 * The branches of the run, or undefined when an argument cannot name one. The
 * orchestrating session assigns these at dispatch, where it learns a pull
 * request number only once a worker has opened one.
 */
export const branchNames = (
  args: readonly string[]
): readonly string[] | undefined => {
  const usable =
    args.length > 0 &&
    args.every(
      (arg) =>
        BRANCH_NAME.test(arg) &&
        !FORBIDDEN_IN_REF.test(arg) &&
        !ALL_DIGITS.test(arg)
    );
  return usable ? args : undefined;
};

/** One entry of `git worktree list --porcelain`. */
export interface Worktree {
  readonly branch: string | undefined;
  readonly locked: boolean;
  readonly path: string;
  readonly prunable: boolean;
}

const HOME_SEGMENT = "/.claude/worktrees/";

/**
 * The agent worktrees of `git worktree list --porcelain`. The main checkout and
 * any worktree outside `.claude/worktrees/` are left out. A person's own
 * `claude --worktree` session lives in that directory too, so the path is not
 * what tells a worker's leftovers from theirs.
 */
export const agentWorktrees = (porcelain: string): readonly Worktree[] =>
  porcelain
    .split("\n\n")
    .map((block) => {
      const lines = block.split("\n");
      const path = lines
        .find((line) => line.startsWith("worktree "))
        ?.slice("worktree ".length);
      const branch = lines
        .find((line) => line.startsWith("branch refs/heads/"))
        ?.slice("branch refs/heads/".length);
      return {
        branch,
        locked: lines.some((line) => line.startsWith("locked")),
        path: path ?? "",
        prunable: lines.some((line) => line.startsWith("prunable")),
      };
    })
    .filter((worktree) => worktree.path.includes(HOME_SEGMENT));

const WORKTREE_BRANCH_PREFIX = "worktree-";

const AGENT_BRANCH_PREFIX = `${WORKTREE_BRANCH_PREFIX}agent-`;

export type WorktreeVerdict =
  | { readonly kind: "branch-kept"; readonly reason: string }
  | { readonly kind: "keep"; readonly reason: string }
  | { readonly kind: "remove" };

export type WorktreeProbe =
  | { readonly branch: string; readonly kind: "probe" }
  | { readonly kind: "verdict"; readonly verdict: WorktreeVerdict };

/**
 * What the porcelain entry and the run's branches alone decide. A prunable
 * entry names a directory that is already gone, so every later step, starting
 * with reading its status, would fail on it. A branch the run did not name
 * belongs to another run or to a person's own session; one still on the branch
 * Claude Code created for the worktree is what a worker that died before
 * `git switch -c` leaves, and a person's own session sitting on that branch
 * looks the same from here, so the reason names the branch rather than the
 * worker.
 */
export const worktreeProbe = (
  worktree: Worktree,
  run: readonly string[]
): WorktreeProbe => {
  if (worktree.prunable) {
    return { kind: "verdict", verdict: { kind: "keep", reason: "prunable" } };
  }
  if (worktree.branch === undefined) {
    return { kind: "verdict", verdict: { kind: "keep", reason: "detached" } };
  }
  if (run.includes(worktree.branch)) {
    return { branch: worktree.branch, kind: "probe" };
  }
  return {
    kind: "verdict",
    verdict: {
      kind: "keep",
      reason: worktree.branch.startsWith(AGENT_BRANCH_PREFIX)
        ? "never switched off the branch Claude Code created"
        : "not in this run",
    },
  };
};

/**
 * The verdict the worktree's own files decide, or undefined when GitHub has to
 * be asked. Reading the status first keeps a worktree someone is working in
 * from depending on whether `gh` answers.
 */
export const localVerdict = (isDirty: boolean): WorktreeVerdict | undefined =>
  isDirty ? { kind: "keep", reason: "uncommitted changes" } : undefined;

/** What `git merge-base --is-ancestor` answered about two commits. */
export type Ancestry =
  | { readonly kind: "ancestor" }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "not-ancestor" };

/**
 * Why the commits of a branch keep what holds them, or undefined when `holder`
 * already holds every one of them. A check that could not run is its own
 * answer, because reading it as "not an ancestor" would keep the branch with a
 * reason naming the wrong cause. A squash merge leaves the branch's commits
 * outside main's ancestry, so the reason states what git answered rather than
 * calling the branch unmerged.
 */
export const ancestryKeepReason = (
  ancestry: Ancestry,
  holder: string
): string | undefined => {
  if (ancestry.kind === "ancestor") {
    return undefined;
  }
  if (ancestry.kind === "not-ancestor") {
    return `commits ${holder} does not hold`;
  }
  return `git could not compare with ${holder}: ${ancestry.reason}`;
};

/**
 * What GitHub and git report about the worktree of a branch the run named. Each
 * shape names the commit whose history the branch was looked for in: main when
 * GitHub reports no pull request for the branch, and the commit GitHub holds
 * for it when there is one.
 */
export type WorktreeFacts =
  | { readonly kind: "no-pull-request"; readonly mainAncestry: Ancestry }
  | {
      readonly kind: "pull-request";
      readonly pullRequest: PullRequest;
      readonly pullRequestAncestry: Ancestry;
    };

/**
 * Whether the worktree of a branch this run named can go. Removing it deletes
 * the branch, so what decides is whether anything else holds the branch's
 * commits: main for a branch whose worker died before opening a pull request,
 * and otherwise the commit GitHub holds, because a squash merge leaves the
 * branch's commits outside main's ancestry. Ancestry rather than equality,
 * because the branch also differs from GitHub's commit when it sits behind one
 * a worker never pulled, and nothing of the branch's own is lost then.
 */
export const worktreeVerdict = (facts: WorktreeFacts): WorktreeVerdict => {
  if (facts.kind === "no-pull-request") {
    const mainReason = ancestryKeepReason(facts.mainAncestry, "main");
    return mainReason === undefined
      ? { kind: "remove" }
      : { kind: "keep", reason: `no pull request, ${mainReason}` };
  }
  const { pullRequest, pullRequestAncestry } = facts;
  if (pullRequest.state !== "MERGED" && pullRequest.state !== "CLOSED") {
    return { kind: "keep", reason: `pull request ${pullRequest.state}` };
  }
  const reason = ancestryKeepReason(pullRequestAncestry, "the pull request");
  return reason === undefined ? { kind: "remove" } : { kind: "keep", reason };
};

/** The one line `clean-worktrees` prints for a worktree. */
export const formatVerdict = (
  worktree: Worktree,
  verdict: WorktreeVerdict
): string => {
  if (verdict.kind === "remove") {
    return `removed ${worktree.path}`;
  }
  if (verdict.kind === "branch-kept") {
    return `removed ${worktree.path} (branch kept: ${verdict.reason})`;
  }
  return `kept ${worktree.path} (${verdict.reason})`;
};

/**
 * The branch Claude Code created for a worktree. Every worktree it made in this
 * repository sits at `.claude/worktrees/agent-<id>` on branch
 * `worktree-agent-<id>`, and a worker leaves that branch behind when it
 * switches to the branch it was given.
 */
const createdBranchOf = (path: string): string =>
  `${WORKTREE_BRANCH_PREFIX}${path.slice(path.lastIndexOf("/") + 1)}`;

/**
 * The branches Claude Code makes for its worktrees, minus the ones a listed
 * worktree still answers for. `git worktree remove` leaves this branch behind,
 * so one ref accumulates per dispatch, and a worktree whose worker switched off
 * that branch is still standing on it, so a listed path holds its created
 * branch as well as its checked-out one.
 */
export const strandedAgentBranches = (
  branches: readonly string[],
  worktrees: readonly Worktree[]
): readonly string[] => {
  const held = new Set(
    worktrees.flatMap((worktree) => [
      worktree.branch,
      createdBranchOf(worktree.path),
    ])
  );
  return branches.filter(
    (branch) => branch.startsWith(AGENT_BRANCH_PREFIX) && !held.has(branch)
  );
};

/** The one line `clean-worktrees` prints for a branch it tried to delete. */
export const formatBranch = (branch: string, reason?: string): string =>
  reason === undefined
    ? `removed branch ${branch}`
    : `kept branch ${branch} (${reason})`;
