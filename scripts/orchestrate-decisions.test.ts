import { describe, expect, it } from "vite-plus/test";
import {
  agentWorktrees,
  formatEvent,
  formatVerdict,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  livePullRequest,
  localVerdict,
  prNumbers,
  watchEvent,
  worktreeProbe,
  worktreeVerdict,
} from "./orchestrate-decisions";
import type { PrRow, PullRequest, Worktree } from "./orchestrate-decisions";

const GIB = 1024 ** 3;

const NO_PULL_REQUEST: PullRequest | undefined = undefined;

describe(freeGibFromMemoryPressure, () => {
  it("should multiply the free percentage by the machine's memory when the percentage line is present", () => {
    const output = "Pageouts: 0\n\nSystem-wide memory free percentage: 50%\n";

    const gib = freeGibFromMemoryPressure(output, 64 * GIB);

    expect(gib).toBe(32);
  });

  it("should return undefined when the percentage line is absent", () => {
    const gib = freeGibFromMemoryPressure(
      "The system has 2 memory pressure levels\n",
      64 * GIB
    );

    expect(gib).toBeUndefined();
  });
});

describe(freeGibFromFreeB, () => {
  it("should read the available column when a Mem row is present", () => {
    const output = [
      "               total        used        free      shared  buff/cache   available",
      `Mem:     ${8 * GIB}  ${2 * GIB}  ${1 * GIB}  0  ${5 * GIB}  ${6 * GIB}`,
      "Swap:              0           0           0",
    ].join("\n");

    const gib = freeGibFromFreeB(output);

    expect(gib).toBe(6);
  });

  it("should return undefined when no Mem row is present", () => {
    const gib = freeGibFromFreeB("free: command not found\n");

    expect(gib).toBeUndefined();
  });
});

const row = (
  number: number,
  mergeable = "MERGEABLE",
  state = "OPEN"
): PrRow => ({
  mergeable,
  number,
  state,
});

describe(watchEvent, () => {
  it("should report all-closed when no watched PR is listed", () => {
    const event = watchEvent([12, 15], [row(99)]);

    expect(event).toStrictEqual({ kind: "all-closed" });
  });

  it("should report all-closed when the watched PRs are listed with a state other than OPEN", () => {
    const event = watchEvent([12], [row(12, "UNKNOWN", "MERGED")]);

    expect(event).toStrictEqual({ kind: "all-closed" });
  });

  it("should name every watched PR when its mergeable is CONFLICTING", () => {
    const event = watchEvent(
      [12, 15, 18],
      [row(12, "CONFLICTING"), row(15), row(18, "CONFLICTING")]
    );

    expect(event).toStrictEqual({ kind: "conflict", numbers: [12, 18] });
  });

  it("should return undefined when the only conflicting PR is one the run does not watch", () => {
    const event = watchEvent([12], [row(12), row(99, "CONFLICTING")]);

    expect(event).toBeUndefined();
  });

  it("should return undefined when a watched PR is open and mergeable", () => {
    const event = watchEvent([12], [row(12)]);

    expect(event).toBeUndefined();
  });
});

describe(formatEvent, () => {
  it("should print all-closed when the event is all-closed", () => {
    const line = formatEvent({ kind: "all-closed" });

    expect(line).toBe("all-closed");
  });

  it("should print conflict followed by the PR numbers when the event is a conflict", () => {
    const line = formatEvent({ kind: "conflict", numbers: [12, 18] });

    expect(line).toBe("conflict 12 18");
  });
});

describe(prNumbers, () => {
  it("should return the parsed numbers when every argument is a positive integer", () => {
    const numbers = prNumbers(["12", "15"]);

    expect(numbers).toStrictEqual([12, 15]);
  });

  it("should return undefined when no argument is given", () => {
    const numbers = prNumbers([]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is not a number", () => {
    const numbers = prNumbers(["12", "main"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument has a fractional part", () => {
    const numbers = prNumbers(["1.5"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is zero or negative", () => {
    const numbers = prNumbers(["0"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is not finite", () => {
    const numbers = prNumbers(["Infinity"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is written in hexadecimal", () => {
    const numbers = prNumbers(["0x10"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is written in exponent notation", () => {
    const numbers = prNumbers(["1e3"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is padded with spaces", () => {
    const numbers = prNumbers([" 12 "]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument exceeds the safe integer range", () => {
    const numbers = prNumbers(["9007199254740993"]);

    expect(numbers).toBeUndefined();
  });
});

const PORCELAIN = [
  "worktree /repo\nHEAD abc\nbranch refs/heads/main",
  "worktree /repo/.claude/worktrees/agent-1\nHEAD def\nbranch refs/heads/feat/one",
  "worktree /repo/.claude/worktrees/agent-2\nHEAD 012\nbranch refs/heads/feat/two\nlocked claude agent",
  "worktree /repo/.claude/worktrees/agent-3\nHEAD 345\ndetached",
  "worktree /repo/.claude/worktrees/agent-4\nHEAD 901\nbranch refs/heads/feat/four\nprunable gitdir file points to non-existent location",
  "worktree /elsewhere/hand-made\nHEAD 678\nbranch refs/heads/feat/three",
  "",
].join("\n\n");

describe(agentWorktrees, () => {
  it("should return only the worktrees under .claude/worktrees when the list holds others", () => {
    const worktrees = agentWorktrees(PORCELAIN);

    expect(worktrees.map((worktree) => worktree.path)).toStrictEqual([
      "/repo/.claude/worktrees/agent-1",
      "/repo/.claude/worktrees/agent-2",
      "/repo/.claude/worktrees/agent-3",
      "/repo/.claude/worktrees/agent-4",
    ]);
  });

  it("should read the branch and the lock of an agent worktree when both are present", () => {
    const worktrees = agentWorktrees(PORCELAIN);

    expect(worktrees[1]).toStrictEqual({
      branch: "feat/two",
      locked: true,
      path: "/repo/.claude/worktrees/agent-2",
      prunable: false,
    });
  });

  it("should leave the branch undefined when the worktree is detached", () => {
    const worktrees = agentWorktrees(PORCELAIN);

    expect(worktrees[2]).toStrictEqual({
      branch: undefined,
      locked: false,
      path: "/repo/.claude/worktrees/agent-3",
      prunable: false,
    });
  });

  it("should mark the worktree prunable when git reports its directory gone", () => {
    const worktrees = agentWorktrees(PORCELAIN);

    expect(worktrees[3]).toStrictEqual({
      branch: "feat/four",
      locked: false,
      path: "/repo/.claude/worktrees/agent-4",
      prunable: true,
    });
  });

  it("should return no extra worktree when the list ends with the blank block git prints", () => {
    const worktrees = agentWorktrees(PORCELAIN);

    expect(worktrees).toHaveLength(4);
  });

  it("should return no worktree when the list holds none under .claude/worktrees", () => {
    const worktrees = agentWorktrees(
      "worktree /repo\nHEAD abc\nbranch refs/heads/main"
    );

    expect(worktrees).toStrictEqual([]);
  });
});

const worktree = (): Worktree => ({
  branch: "feat/one",
  locked: false,
  path: "/repo/.claude/worktrees/agent-1",
  prunable: false,
});

describe(worktreeProbe, () => {
  it("should keep the worktree when git reports it prunable", () => {
    const probe = worktreeProbe({ ...worktree(), prunable: true });

    expect(probe).toStrictEqual({
      kind: "verdict",
      verdict: { kind: "keep", reason: "prunable" },
    });
  });

  it("should keep the worktree when it is detached", () => {
    const probe = worktreeProbe({ ...worktree(), branch: undefined });

    expect(probe).toStrictEqual({
      kind: "verdict",
      verdict: { kind: "keep", reason: "detached" },
    });
  });

  it("should return the branch to probe when the worktree is neither prunable nor detached", () => {
    const probe = worktreeProbe(worktree());

    expect(probe).toStrictEqual({ branch: "feat/one", kind: "probe" });
  });
});

const RUN = [12] as const;

const HEAD_SHA = "0a2c0f8";

const pullRequest = (state: string, number = 12): PullRequest => ({
  headRefOid: HEAD_SHA,
  number,
  state,
});

describe(localVerdict, () => {
  it("should keep the worktree when it holds uncommitted changes", () => {
    const verdict = localVerdict(true);

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "uncommitted changes",
    });
  });

  it("should return undefined when the worktree is clean", () => {
    const verdict = localVerdict(false);

    expect(verdict).toBeUndefined();
  });
});

describe(livePullRequest, () => {
  it("should return the open pull request when a newer finished one is listed first", () => {
    const pr = livePullRequest([
      pullRequest("CLOSED", 20),
      pullRequest("OPEN", 12),
    ]);

    expect(pr).toStrictEqual(pullRequest("OPEN", 12));
  });

  it("should return the newest pull request when none is open", () => {
    const pr = livePullRequest([
      pullRequest("CLOSED", 20),
      pullRequest("MERGED", 12),
    ]);

    expect(pr).toStrictEqual(pullRequest("CLOSED", 20));
  });

  it("should return undefined when the branch has no pull request", () => {
    const pr = livePullRequest([]);

    expect(pr).toBeUndefined();
  });
});

describe(worktreeVerdict, () => {
  it("should keep the worktree when its branch has no pull request", () => {
    const verdict = worktreeVerdict(HEAD_SHA, NO_PULL_REQUEST, RUN);

    expect(verdict).toStrictEqual({ kind: "keep", reason: "no pull request" });
  });

  it("should keep the worktree when its pull request is not one the caller named", () => {
    const verdict = worktreeVerdict(HEAD_SHA, pullRequest("MERGED", 99), RUN);

    expect(verdict).toStrictEqual({ kind: "keep", reason: "not in this run" });
  });

  it("should remove the worktree when its pull request is merged", () => {
    const verdict = worktreeVerdict(HEAD_SHA, pullRequest("MERGED"), RUN);

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should remove the worktree when its pull request is closed", () => {
    const verdict = worktreeVerdict(HEAD_SHA, pullRequest("CLOSED"), RUN);

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should keep the worktree when its HEAD is a commit GitHub does not hold", () => {
    const verdict = worktreeVerdict("deadbee", pullRequest("MERGED"), RUN);

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "commits GitHub has not seen",
    });
  });

  it("should keep the worktree when its pull request is still open", () => {
    const verdict = worktreeVerdict(HEAD_SHA, pullRequest("OPEN"), RUN);

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "pull request OPEN",
    });
  });
});

describe(formatVerdict, () => {
  it("should print removed with the path when the verdict is remove", () => {
    const line = formatVerdict(worktree(), { kind: "remove" });

    expect(line).toBe("removed /repo/.claude/worktrees/agent-1");
  });

  it("should print kept with the reason when the verdict is keep", () => {
    const line = formatVerdict(worktree(), {
      kind: "keep",
      reason: "detached",
    });

    expect(line).toBe("kept /repo/.claude/worktrees/agent-1 (detached)");
  });
});
