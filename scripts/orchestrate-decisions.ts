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

/** The fields of `gh pr view --json number,state,mergeable` the watch reads. */
export interface PrRow {
  readonly mergeable: string;
  readonly number: number;
  readonly state: string;
}

export type WatchEvent =
  | { readonly kind: "all-closed" }
  | { readonly kind: "conflict"; readonly numbers: readonly number[] };

/**
 * What the watch reports back, or undefined while nothing needs the
 * orchestrator. `rows` holds one row per watched PR, and a watched PR with no
 * row counts as closed.
 */
export const watchEvent = (
  watched: readonly number[],
  rows: readonly PrRow[]
): WatchEvent | undefined => {
  const open = rows.filter(
    (row) => watched.includes(row.number) && row.state === "OPEN"
  );
  if (open.length === 0) {
    return { kind: "all-closed" };
  }
  const conflicting = open
    .filter((row) => row.mergeable === "CONFLICTING")
    .map((row) => row.number);
  if (conflicting.length > 0) {
    return { kind: "conflict", numbers: conflicting };
  }
  return undefined;
};

/** The one line the watch prints before exiting. */
export const formatEvent = (event: WatchEvent): string =>
  event.kind === "all-closed"
    ? "all-closed"
    : `conflict ${event.numbers.join(" ")}`;

/**
 * `Number` reads `0x10`, `1e3` and ` 12 ` as integers, so the digits are
 * matched before the conversion rather than after it.
 */
const DECIMAL = /^[1-9]\d*$/u;

/**
 * The PR numbers of `watch-prs`, or undefined when an argument is not one.
 * `gh pr view 1.5` reports a PR that does not exist rather than the argument
 * that was wrong, so the shape is rejected before `gh` sees it.
 */
export const prNumbers = (
  args: readonly string[]
): readonly number[] | undefined => {
  const usable =
    args.length > 0 &&
    args.every((arg) => DECIMAL.test(arg) && Number.isSafeInteger(Number(arg)));
  return usable ? args.map(Number) : undefined;
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
 * What the porcelain entry alone decides. A prunable entry names a directory
 * that is already gone, so every later step, starting with reading its status,
 * would fail on it.
 */
export const worktreeProbe = (worktree: Worktree): WorktreeProbe => {
  if (worktree.prunable) {
    return { kind: "verdict", verdict: { kind: "keep", reason: "prunable" } };
  }
  if (worktree.branch === undefined) {
    return { kind: "verdict", verdict: { kind: "keep", reason: "detached" } };
  }
  return { branch: worktree.branch, kind: "probe" };
};

/** The fields of `gh pr list --json headRefOid,number,state` the cleanup reads. */
export interface PullRequest {
  readonly headRefOid: string;
  readonly number: number;
  readonly state: string;
}

/**
 * The verdict the worktree's own files decide, or undefined when GitHub has to
 * be asked. Reading the status first keeps a worktree someone is working in
 * from depending on whether `gh` answers.
 */
export const localVerdict = (isDirty: boolean): WorktreeVerdict | undefined =>
  isDirty ? { kind: "keep", reason: "uncommitted changes" } : undefined;

/**
 * Whether a finished worker's worktree can go. `pr` is the pull request GitHub
 * reports for the branch, or undefined when the branch has none, and `run`
 * holds the pull request numbers the caller named. A worktree outside that set
 * belongs to another run or to a person's own session, both of which live in
 * the same directory, so naming the run is what separates them. `headSha` is
 * the worktree's own HEAD, compared with the commit GitHub holds because a
 * squash merge leaves the branch's commits outside main's ancestry, where an
 * ancestry test would answer nothing.
 */
export const worktreeVerdict = (
  headSha: string,
  pr: PullRequest | undefined,
  run: readonly number[]
): WorktreeVerdict => {
  if (pr === undefined) {
    return { kind: "keep", reason: "no pull request" };
  }
  if (!run.includes(pr.number)) {
    return { kind: "keep", reason: "not in this run" };
  }
  if (pr.state !== "MERGED" && pr.state !== "CLOSED") {
    return { kind: "keep", reason: `pull request ${pr.state}` };
  }
  if (pr.headRefOid !== headSha) {
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
