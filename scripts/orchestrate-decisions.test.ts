import { describe, expect, it } from "vite-plus/test";
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
  strandedAgentBranches,
  watchEvent,
  worktreeProbe,
  worktreeVerdict,
} from "./orchestrate-decisions";
import type { PullRequest, Worktree } from "./orchestrate-decisions";

const GIB = 1024 ** 3;

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

const HEAD_SHA = "0a2c0f8";

const pullRequest = (state: string, mergeable = "MERGEABLE"): PullRequest => ({
  headRefOid: HEAD_SHA,
  mergeable,
  state,
});

const NO_PULL_REQUEST: PullRequest | undefined = undefined;

describe(watchEvent, () => {
  it("should name every branch when its open pull request is CONFLICTING", () => {
    const event = watchEvent([
      { branch: "feat/a", pullRequest: pullRequest("OPEN", "CONFLICTING") },
      { branch: "feat/b", pullRequest: pullRequest("OPEN") },
      { branch: "feat/c", pullRequest: pullRequest("OPEN", "CONFLICTING") },
    ]);

    expect(event).toStrictEqual({
      branches: ["feat/a", "feat/c"],
      kind: "conflict",
    });
  });

  it("should report all-closed when every branch's pull request is finished", () => {
    const event = watchEvent([
      { branch: "feat/a", pullRequest: pullRequest("MERGED", "UNKNOWN") },
      { branch: "feat/b", pullRequest: pullRequest("CLOSED", "UNKNOWN") },
    ]);

    expect(event).toStrictEqual({ kind: "all-closed" });
  });

  it("should report all-closed when a finished pull request is CONFLICTING", () => {
    const event = watchEvent([
      { branch: "feat/a", pullRequest: pullRequest("CLOSED", "CONFLICTING") },
    ]);

    expect(event).toStrictEqual({ kind: "all-closed" });
  });

  it("should return undefined when a branch has no pull request yet", () => {
    const event = watchEvent([
      { branch: "feat/a", pullRequest: NO_PULL_REQUEST },
      { branch: "feat/b", pullRequest: pullRequest("MERGED", "UNKNOWN") },
    ]);

    expect(event).toBeUndefined();
  });

  it("should return undefined when a branch's pull request is open and mergeable", () => {
    const event = watchEvent([
      { branch: "feat/a", pullRequest: pullRequest("OPEN") },
    ]);

    expect(event).toBeUndefined();
  });
});

describe(formatEvent, () => {
  it("should print all-closed when the event is all-closed", () => {
    const line = formatEvent({ kind: "all-closed" });

    expect(line).toBe("all-closed");
  });

  it("should print conflict followed by the branches when the event is a conflict", () => {
    const line = formatEvent({
      branches: ["feat/a", "feat/c"],
      kind: "conflict",
    });

    expect(line).toBe("conflict feat/a feat/c");
  });
});

describe(branchNames, () => {
  it("should return the arguments when every one of them can name a branch", () => {
    const branches = branchNames(["feat/a", "docs_b", "fix.c-2"]);

    expect(branches).toStrictEqual(["feat/a", "docs_b", "fix.c-2"]);
  });

  it("should return undefined when no argument is given", () => {
    const branches = branchNames([]);

    expect(branches).toBeUndefined();
  });

  it("should return undefined when an argument starts with a dash", () => {
    const branches = branchNames(["--state"]);

    expect(branches).toBeUndefined();
  });

  it("should return undefined when an argument holds a space", () => {
    const branches = branchNames(["feat/a b"]);

    expect(branches).toBeUndefined();
  });

  it("should return undefined when an argument holds a character git forbids in a ref", () => {
    const branches = branchNames(["feat/a^"]);

    expect(branches).toBeUndefined();
  });

  it("should return undefined when an argument ends with a slash", () => {
    const branches = branchNames(["feat/"]);

    expect(branches).toBeUndefined();
  });

  it("should return undefined when an argument is a pull request number", () => {
    const branches = branchNames(["12"]);

    expect(branches).toBeUndefined();
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

const RUN = ["feat/one"] as const;

const worktree = (): Worktree => ({
  branch: "feat/one",
  locked: false,
  path: "/repo/.claude/worktrees/agent-1",
  prunable: false,
});

describe(worktreeProbe, () => {
  it("should keep the worktree when git reports it prunable", () => {
    const probe = worktreeProbe({ ...worktree(), prunable: true }, RUN);

    expect(probe).toStrictEqual({
      kind: "verdict",
      verdict: { kind: "keep", reason: "prunable" },
    });
  });

  it("should keep the worktree when it is detached", () => {
    const probe = worktreeProbe({ ...worktree(), branch: undefined }, RUN);

    expect(probe).toStrictEqual({
      kind: "verdict",
      verdict: { kind: "keep", reason: "detached" },
    });
  });

  it("should keep the worktree when its branch is one the run did not name", () => {
    const probe = worktreeProbe({ ...worktree(), branch: "feat/mine" }, RUN);

    expect(probe).toStrictEqual({
      kind: "verdict",
      verdict: { kind: "keep", reason: "not in this run" },
    });
  });

  it("should name the created branch when the worktree is still on the one Claude Code made", () => {
    const probe = worktreeProbe(
      { ...worktree(), branch: "worktree-agent-1" },
      RUN
    );

    expect(probe).toStrictEqual({
      kind: "verdict",
      verdict: {
        kind: "keep",
        reason: "never switched off the branch Claude Code created",
      },
    });
  });

  it("should return the branch to probe when the run named it", () => {
    const probe = worktreeProbe(worktree(), RUN);

    expect(probe).toStrictEqual({ branch: "feat/one", kind: "probe" });
  });
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

describe(ancestryKeepReason, () => {
  it("should return undefined when main holds the branch commits", () => {
    const reason = ancestryKeepReason({ kind: "ancestor" });

    expect(reason).toBeUndefined();
  });

  it("should name the commits when the branch holds one main does not", () => {
    const reason = ancestryKeepReason({ kind: "not-ancestor" });

    expect(reason).toBe("commits main does not hold");
  });

  it("should name the failure when the ancestry check could not run", () => {
    const reason = ancestryKeepReason({
      kind: "failed",
      reason: "fatal: not a git repository",
    });

    expect(reason).toBe("failed: fatal: not a git repository");
  });
});

describe(worktreeVerdict, () => {
  it("should remove the worktree when its branch has no pull request and main holds its HEAD", () => {
    const verdict = worktreeVerdict({
      ancestry: { kind: "ancestor" },
      headSha: HEAD_SHA,
      pullRequest: NO_PULL_REQUEST,
    });

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should keep the worktree when its branch has no pull request and holds a commit main does not", () => {
    const verdict = worktreeVerdict({
      ancestry: { kind: "not-ancestor" },
      headSha: HEAD_SHA,
      pullRequest: NO_PULL_REQUEST,
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "no pull request, commits main does not hold",
    });
  });

  it("should keep the worktree when its branch has no pull request and the ancestry check could not run", () => {
    const verdict = worktreeVerdict({
      ancestry: { kind: "failed", reason: "fatal: bad revision" },
      headSha: HEAD_SHA,
      pullRequest: NO_PULL_REQUEST,
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "no pull request, failed: fatal: bad revision",
    });
  });

  it("should keep the worktree when its pull request is still open", () => {
    const verdict = worktreeVerdict({
      ancestry: { kind: "ancestor" },
      headSha: HEAD_SHA,
      pullRequest: pullRequest("OPEN"),
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "pull request OPEN",
    });
  });

  it("should keep the worktree when its HEAD is a commit GitHub does not hold", () => {
    const verdict = worktreeVerdict({
      ancestry: { kind: "ancestor" },
      headSha: "deadbee",
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "commits GitHub has not seen",
    });
  });

  it("should remove the worktree when its pull request is merged", () => {
    const verdict = worktreeVerdict({
      ancestry: { kind: "not-ancestor" },
      headSha: HEAD_SHA,
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
    });

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should remove the worktree when its pull request is closed", () => {
    const verdict = worktreeVerdict({
      ancestry: { kind: "not-ancestor" },
      headSha: HEAD_SHA,
      pullRequest: pullRequest("CLOSED", "UNKNOWN"),
    });

    expect(verdict).toStrictEqual({ kind: "remove" });
  });
});

describe(formatVerdict, () => {
  it("should print removed with the path when the verdict is remove", () => {
    const line = formatVerdict(worktree(), { kind: "remove" });

    expect(line).toBe("removed /repo/.claude/worktrees/agent-1");
  });

  it("should print removed with the branch reason when the branch could not be deleted", () => {
    const line = formatVerdict(worktree(), {
      kind: "branch-kept",
      reason: "checked out somewhere",
    });

    expect(line).toBe(
      "removed /repo/.claude/worktrees/agent-1 (branch kept: checked out somewhere)"
    );
  });

  it("should print kept with the reason when the verdict is keep", () => {
    const line = formatVerdict(worktree(), {
      kind: "keep",
      reason: "detached",
    });

    expect(line).toBe("kept /repo/.claude/worktrees/agent-1 (detached)");
  });
});

describe(strandedAgentBranches, () => {
  it("should return the agent branch when no worktree is listed for it", () => {
    const stranded = strandedAgentBranches(
      ["main", "worktree-agent-2", "feat/one"],
      [worktree()]
    );

    expect(stranded).toStrictEqual(["worktree-agent-2"]);
  });

  it("should return no branch when a worktree has it checked out", () => {
    const stranded = strandedAgentBranches(
      ["main", "worktree-agent-2"],
      [{ ...worktree(), branch: "worktree-agent-2" }]
    );

    expect(stranded).toStrictEqual([]);
  });

  it("should return no branch when a listed worktree was created on it", () => {
    const stranded = strandedAgentBranches(
      ["main", "worktree-agent-1"],
      [worktree()]
    );

    expect(stranded).toStrictEqual([]);
  });

  it("should return no branch when a detached worktree reports no branch", () => {
    const stranded = strandedAgentBranches(
      ["main"],
      [{ ...worktree(), branch: undefined }]
    );

    expect(stranded).toStrictEqual([]);
  });
});

describe(formatBranch, () => {
  it("should print removed branch when the deletion succeeded", () => {
    const line = formatBranch("worktree-agent-1");

    expect(line).toBe("removed branch worktree-agent-1");
  });

  it("should print kept branch with the reason when the deletion refused", () => {
    const line = formatBranch("worktree-agent-1", "not fully merged");

    expect(line).toBe("kept branch worktree-agent-1 (not fully merged)");
  });
});
