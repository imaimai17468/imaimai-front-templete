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
 * `gh pr list --head -x` reads the argument as a flag, and a name holding a
 * character git forbids in a ref matches no pull request, which the watch would
 * wait on for as long as it runs. Both shapes are rejected before `gh` sees
 * them.
 */
const BRANCH_NAME = /^\w[\w./-]*(?<![./])$/u;

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
    args.every((arg) => BRANCH_NAME.test(arg) && !ALL_DIGITS.test(arg));
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
 * belongs to another run or to a person's own session, both of which live in
 * the same directory, so naming the run is what separates them.
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
    verdict: { kind: "keep", reason: "not in this run" },
  };
};

/**
 * The verdict the worktree's own files decide, or undefined when GitHub has to
 * be asked. Reading the status first keeps a worktree someone is working in
 * from depending on whether `gh` answers.
 */
export const localVerdict = (isDirty: boolean): WorktreeVerdict | undefined =>
  isDirty ? { kind: "keep", reason: "uncommitted changes" } : undefined;

/**
 * Whether the worktree of a branch this run named can go. `pullRequest` is what
 * GitHub reports for the branch, or undefined when the branch has none.
 * `headSha` is the worktree's own HEAD, compared with the commit GitHub holds
 * because a squash merge leaves the branch's commits outside main's ancestry,
 * where an ancestry test would answer nothing.
 */
export const worktreeVerdict = (
  headSha: string,
  pullRequest: PullRequest | undefined
): WorktreeVerdict => {
  if (pullRequest === undefined) {
    return { kind: "keep", reason: "no pull request" };
  }
  if (pullRequest.state !== "MERGED" && pullRequest.state !== "CLOSED") {
    return { kind: "keep", reason: `pull request ${pullRequest.state}` };
  }
  if (pullRequest.headRefOid !== headSha) {
    return { kind: "keep", reason: "commits GitHub has not seen" };
  }
  return { kind: "remove" };
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

const AGENT_BRANCH_PREFIX = "worktree-agent-";

/**
 * The branches Claude Code makes for its worktrees, minus the ones a worktree
 * still holds. `git worktree remove` leaves this branch behind, so one ref
 * accumulates per dispatch.
 */
export const strandedAgentBranches = (
  branches: readonly string[],
  held: readonly (string | undefined)[]
): readonly string[] =>
  branches.filter(
    (branch) => branch.startsWith(AGENT_BRANCH_PREFIX) && !held.includes(branch)
  );

/** The one line `clean-worktrees` prints for a branch it tried to delete. */
export const formatBranch = (branch: string, reason?: string): string =>
  reason === undefined
    ? `removed branch ${branch}`
    : `kept branch ${branch} (${reason})`;

/** What `git merge-base --is-ancestor` answered about a branch and main. */
export type Ancestry =
  | { readonly kind: "ancestor" }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "not-ancestor" };

/**
 * Why a stranded agent branch stays, or undefined when it can go. A check that
 * could not run is its own answer, because reading it as "not an ancestor"
 * would keep the branch with a reason naming the wrong cause.
 */
export const branchKeepReason = (ancestry: Ancestry): string | undefined => {
  if (ancestry.kind === "ancestor") {
    return undefined;
  }
  if (ancestry.kind === "not-ancestor") {
    return "not merged into main";
  }
  return `failed: ${ancestry.reason}`;
};
