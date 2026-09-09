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

/** What `orchestrate.ts` found at the path it reads, before anything parsed it. */
export type RateLimitsFile =
  | { readonly kind: "absent" }
  | { readonly kind: "content"; readonly text: string }
  | { readonly detail: string; readonly kind: "unreadable" };

/** A usage window of the account, under the key the file holds it at. */
interface BudgetWindowSpec {
  readonly key: string;
  readonly label: string;
}

/** The windows the line prints, in order. A further window joins as an entry. */
const BUDGET_WINDOWS: readonly BudgetWindowSpec[] = [
  { key: "five_hour", label: "5h" },
  { key: "seven_day", label: "7d" },
];

/**
 * One window of the line. Each window is absent from the file on its own, and
 * one the file carries past its own reset holds what was spent in a window
 * that has since restarted, so both get an answer of their own rather than a
 * percentage.
 */
export type BudgetWindowReading =
  | { readonly kind: "expired"; readonly label: string }
  | { readonly kind: "no-window"; readonly label: string }
  | {
      readonly kind: "window";
      readonly label: string;
      readonly resetsInSeconds: number;
      readonly usedPercentage: number;
    };

/** Why the command has no percentage to print. */
export type BudgetUnknown =
  | { readonly kind: "absent" }
  | { readonly kind: "no-json" }
  | { readonly kind: "no-rate-limits" }
  | { readonly kind: "no-windows" }
  | { readonly kind: "no-written-at" }
  | { readonly ageSeconds: number; readonly kind: "stale" }
  | { readonly detail: string; readonly kind: "unreadable" };

export type RemainingBudget =
  | {
      readonly ageSeconds: number;
      readonly kind: "budget";
      readonly windows: readonly BudgetWindowReading[];
    }
  | { readonly kind: "unknown"; readonly reason: BudgetUnknown };

/**
 * How long a written file counts as the account's current usage. Past this age
 * `remainingBudget` answers `unknown`, so numbers whose writer stopped are not
 * read as what the windows hold now.
 */
const STALE_AFTER_SECONDS = 120;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The parsed file, carrying the epoch second its writer stamped on it. */
type WrittenFile = Record<string, unknown> & { readonly written_at: number };

const isWrittenFile = (value: unknown): value is WrittenFile =>
  isRecord(value) && typeof value.written_at === "number";

/** One window of `rate_limits`, in the field names the JSON carries. */
interface RateWindowJson {
  readonly resets_at: number;
  readonly used_percentage: number;
}

const isRateWindowJson = (value: unknown): value is RateWindowJson =>
  isRecord(value) &&
  typeof value.used_percentage === "number" &&
  typeof value.resets_at === "number";

const unknownBudget = (reason: BudgetUnknown): RemainingBudget => ({
  kind: "unknown",
  reason,
});

const windowReading = (
  spec: BudgetWindowSpec,
  limits: Record<string, unknown>,
  nowSeconds: number
): BudgetWindowReading => {
  const window: unknown = limits[spec.key];
  if (!isRateWindowJson(window)) {
    return { kind: "no-window", label: spec.label };
  }
  return window.resets_at <= nowSeconds
    ? { kind: "expired", label: spec.label }
    : {
        kind: "window",
        label: spec.label,
        resetsInSeconds: window.resets_at - nowSeconds,
        usedPercentage: window.used_percentage,
      };
};

/**
 * What the file says about the account's usage windows. Every shape without a
 * window carrying numbers answers `unknown`, which the caller prints in place
 * of a percentage.
 */
export const remainingBudget = (
  file: RateLimitsFile,
  nowSeconds: number
): RemainingBudget => {
  if (file.kind === "absent") {
    return unknownBudget({ kind: "absent" });
  }
  if (file.kind === "unreadable") {
    return unknownBudget({ detail: file.detail, kind: "unreadable" });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text);
  } catch {
    return unknownBudget({ kind: "no-json" });
  }
  if (!isWrittenFile(parsed)) {
    return unknownBudget({ kind: "no-written-at" });
  }
  const limits: unknown = parsed.rate_limits;
  if (!isRecord(limits)) {
    return unknownBudget({ kind: "no-rate-limits" });
  }
  const ageSeconds = Math.max(0, nowSeconds - parsed.written_at);
  if (ageSeconds > STALE_AFTER_SECONDS) {
    return unknownBudget({ ageSeconds, kind: "stale" });
  }
  const windows = BUDGET_WINDOWS.map((spec) =>
    windowReading(spec, limits, nowSeconds)
  );
  return windows.every((window) => window.kind !== "window")
    ? unknownBudget({ kind: "no-windows" })
    : { ageSeconds, kind: "budget", windows };
};

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;

/** A span in the two largest units it reaches, down to whole seconds. */
const formatSeconds = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const days = Math.floor(whole / SECONDS_PER_DAY);
  const hours = Math.floor((whole % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((whole % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (days > 0) {
    return `${days}d${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return minutes > 0 ? `${minutes}m` : `${whole}s`;
};

const formatWindow = (window: BudgetWindowReading): string => {
  if (window.kind === "no-window") {
    return `${window.label} unknown`;
  }
  if (window.kind === "expired") {
    return `${window.label} unknown, that window has reset`;
  }
  return `${window.label} ${Math.round(window.usedPercentage)}% resets in ${formatSeconds(window.resetsInSeconds)}`;
};

/** A reason the file itself explains, against one the reader has to. */
type StatedUnknown = Exclude<BudgetUnknown["kind"], "stale" | "unreadable">;

const UNKNOWN_STATEMENTS = {
  absent:
    "is not there, so no status line has written the account's usage windows on this machine",
  "no-json": "holds no JSON",
  "no-rate-limits": "holds no rate_limits object",
  "no-windows":
    "carries no five-hour or seven-day window whose reset is still ahead",
  "no-written-at": "holds no numeric written_at",
} satisfies Record<StatedUnknown, string>;

const formatUnknown = (reason: BudgetUnknown, path: string): string => {
  if (reason.kind === "stale") {
    return `unknown ${path} is ${formatSeconds(reason.ageSeconds)} old, past the ${formatSeconds(STALE_AFTER_SECONDS)} this command treats as current`;
  }
  if (reason.kind === "unreadable") {
    return `unknown ${path} could not be read: ${reason.detail}`;
  }
  return `unknown ${path} ${UNKNOWN_STATEMENTS[reason.kind]}`;
};

/** The one line `remaining-budget` prints. */
export const formatRemainingBudget = (
  budget: RemainingBudget,
  path: string
): string =>
  budget.kind === "unknown"
    ? formatUnknown(budget.reason, path)
    : `budget ${budget.windows.map(formatWindow).join(", ")}, written ${formatSeconds(budget.ageSeconds)} ago`;

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

/**
 * Where git put one commit relative to another's history. `absent` is the
 * second commit missing from the repository, which is what the commit GitHub
 * reports for a pull request is once the remote branch is deleted and nothing
 * fetched it, and `failed` is a check that did not answer either way.
 */
export type Ancestry =
  | { readonly commit: string; readonly kind: "absent" }
  | { readonly kind: "ancestor" }
  | { readonly kind: "failed"; readonly reason: string }
  | { readonly kind: "not-ancestor" };

/**
 * Why the commits of a branch keep what holds them, or undefined when `holder`
 * already holds every one of them. A commit this repository does not have and a
 * check that did not run are each their own answer, because reading either as
 * "not an ancestor" would keep the branch with a reason naming the wrong cause.
 * A squash merge leaves the branch's commits outside main's ancestry, so the
 * reason states what git answered rather than calling the branch unmerged.
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
  if (ancestry.kind === "absent") {
    return `${holder} is at commit ${ancestry.commit}, which this repository does not have`;
  }
  return `git could not compare with ${holder}: ${ancestry.reason}`;
};

/**
 * What GitHub and git report about the worktree of a branch the run named. Each
 * shape names every commit whose history the branch was looked for in: main
 * alone when GitHub reports no pull request for the branch, and main together
 * with the commit GitHub holds for it when there is one.
 */
export type WorktreeFacts =
  | { readonly kind: "no-pull-request"; readonly mainAncestry: Ancestry }
  | {
      readonly kind: "pull-request";
      readonly mainAncestry: Ancestry;
      readonly pullRequest: PullRequest;
      readonly pullRequestAncestry: Ancestry;
    };

/**
 * Whether the worktree of a branch this run named can go. Removing it deletes
 * the branch, so what decides is whether anything else holds the branch's
 * commits. Two commits are asked, and either one holding them clears the
 * worktree: the commit GitHub holds for the pull request, and main. Which of
 * them answers depends on the branch. A squash merge leaves the commits a
 * branch carried outside main's ancestry, so the pull request's commit is what
 * holds those, and main holds a branch that ended at a commit main already had.
 * Main is the one of the two this repository can still resolve once
 * `gh pr update-branch` has left the pull request at a merge nothing fetched.
 * Ancestry rather than equality, because the branch also differs from GitHub's
 * commit when it sits behind one a worker never pulled, and nothing of the
 * branch's own is lost then.
 */
export const worktreeVerdict = (facts: WorktreeFacts): WorktreeVerdict => {
  if (facts.kind === "no-pull-request") {
    const mainReason = ancestryKeepReason(facts.mainAncestry, "main");
    return mainReason === undefined
      ? { kind: "remove" }
      : { kind: "keep", reason: `no pull request, ${mainReason}` };
  }
  const { mainAncestry, pullRequest, pullRequestAncestry } = facts;
  if (pullRequest.state !== "MERGED" && pullRequest.state !== "CLOSED") {
    return { kind: "keep", reason: `pull request ${pullRequest.state}` };
  }
  const pullRequestReason = ancestryKeepReason(
    pullRequestAncestry,
    "the pull request"
  );
  const mainReason = ancestryKeepReason(mainAncestry, "main");
  return pullRequestReason === undefined || mainReason === undefined
    ? { kind: "remove" }
    : { kind: "keep", reason: `${pullRequestReason}, and ${mainReason}` };
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
