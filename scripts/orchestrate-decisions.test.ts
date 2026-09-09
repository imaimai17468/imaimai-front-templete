import { describe, expect, it } from "vite-plus/test";
import {
  agentWorktrees,
  ancestryKeepReason,
  branchNames,
  formatBranch,
  formatEvent,
  formatRemainingBudget,
  formatVerdict,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  localVerdict,
  prListing,
  remainingBudget,
  strandedAgentBranches,
  watchEvent,
  worktreeProbe,
  worktreeVerdict,
} from "./orchestrate-decisions";
import type {
  PullRequest,
  RateLimitsFile,
  Worktree,
} from "./orchestrate-decisions";

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

const NOW_SECONDS = 1_788_912_806;

const FIVE_HOUR = { resets_at: NOW_SECONDS + 8000, used_percentage: 23.5 };

const SEVEN_DAY = { resets_at: NOW_SECONDS + 273_600, used_percentage: 41.2 };

const RATE_LIMITS_PATH = "/home/dev/.claude/rate-limits.json";

const fileHolding = (value: unknown): RateLimitsFile => ({
  kind: "content",
  text: JSON.stringify(value),
});

describe(remainingBudget, () => {
  it("should report both windows when the file carries them and was written just now", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: { five_hour: FIVE_HOUR, seven_day: SEVEN_DAY },
        written_at: NOW_SECONDS - 8,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 8,
      kind: "budget",
      windows: [
        {
          kind: "window",
          label: "5h",
          resetsInSeconds: 8000,
          usedPercentage: 23.5,
        },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should report the five-hour window as no-window when the file carries only the seven-day one", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: { seven_day: SEVEN_DAY },
        written_at: NOW_SECONDS,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 0,
      kind: "budget",
      windows: [
        { kind: "no-window", label: "5h" },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should report a window as no-window when its used_percentage is not a number", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: {
          five_hour: { resets_at: NOW_SECONDS + 8000, used_percentage: "23.5" },
          seven_day: SEVEN_DAY,
        },
        written_at: NOW_SECONDS,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 0,
      kind: "budget",
      windows: [
        { kind: "no-window", label: "5h" },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should report a window as no-window when its resets_at is not a number", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: {
          five_hour: { resets_at: null, used_percentage: 23.5 },
          seven_day: SEVEN_DAY,
        },
        written_at: NOW_SECONDS,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 0,
      kind: "budget",
      windows: [
        { kind: "no-window", label: "5h" },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should report a window as expired when its reset has already passed", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: {
          five_hour: { resets_at: NOW_SECONDS, used_percentage: 92 },
          seven_day: SEVEN_DAY,
        },
        written_at: NOW_SECONDS,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 0,
      kind: "budget",
      windows: [
        { kind: "expired", label: "5h" },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should answer no-windows when every window the file carries has reset", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: {
          five_hour: { resets_at: NOW_SECONDS - 3600, used_percentage: 92 },
          seven_day: { resets_at: NOW_SECONDS - 60, used_percentage: 65 },
        },
        written_at: NOW_SECONDS,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "no-windows" },
    });
  });

  it("should count the age as zero when the file was written ahead of the clock", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: { five_hour: FIVE_HOUR, seven_day: SEVEN_DAY },
        written_at: NOW_SECONDS + 30,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 0,
      kind: "budget",
      windows: [
        {
          kind: "window",
          label: "5h",
          resetsInSeconds: 8000,
          usedPercentage: 23.5,
        },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should answer no-windows when the file carries neither window", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: { spend_limit: FIVE_HOUR },
        written_at: NOW_SECONDS,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "no-windows" },
    });
  });

  it("should answer stale when the file was written before the freshness threshold", () => {
    const budget = remainingBudget(
      fileHolding({
        rate_limits: { five_hour: FIVE_HOUR },
        written_at: NOW_SECONDS - 900,
      }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { ageSeconds: 900, kind: "stale" },
    });
  });

  it("should answer absent when no file was found", () => {
    const budget = remainingBudget({ kind: "absent" }, NOW_SECONDS);

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "absent" },
    });
  });

  it("should keep what the reader said when the file could not be opened", () => {
    const budget = remainingBudget(
      { detail: "EACCES", kind: "unreadable" },
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { detail: "EACCES", kind: "unreadable" },
    });
  });

  it("should answer no-json when the file holds no JSON", () => {
    const budget = remainingBudget(
      { kind: "content", text: "{oops" },
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "no-json" },
    });
  });

  it("should answer no-written-at when the JSON is not an object", () => {
    const budget = remainingBudget(
      { kind: "content", text: "12" },
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "no-written-at" },
    });
  });

  it("should answer no-written-at when written_at overflows to Infinity", () => {
    const budget = remainingBudget(
      { kind: "content", text: '{"rate_limits":{},"written_at":1e400}' },
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "no-written-at" },
    });
  });

  it("should report a window as no-window when its used_percentage overflows to Infinity", () => {
    const budget = remainingBudget(
      {
        kind: "content",
        text: `{"rate_limits":{"five_hour":{"used_percentage":1e400,"resets_at":${
          NOW_SECONDS + 8000
        }},"seven_day":${JSON.stringify(
          SEVEN_DAY
        )}},"written_at":${NOW_SECONDS}}`,
      },
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 0,
      kind: "budget",
      windows: [
        { kind: "no-window", label: "5h" },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should report a window as no-window when its resets_at overflows to Infinity", () => {
    const budget = remainingBudget(
      {
        kind: "content",
        text: `{"rate_limits":{"five_hour":{"used_percentage":23.5,"resets_at":1e400},"seven_day":${JSON.stringify(
          SEVEN_DAY
        )}},"written_at":${NOW_SECONDS}}`,
      },
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      ageSeconds: 0,
      kind: "budget",
      windows: [
        { kind: "no-window", label: "5h" },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 273_600,
          usedPercentage: 41.2,
        },
      ],
    });
  });

  it("should answer no-written-at when written_at is not a number", () => {
    const budget = remainingBudget(
      fileHolding({ rate_limits: {}, written_at: "2026-09-09" }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "no-written-at" },
    });
  });

  it("should answer no-rate-limits when rate_limits is not an object", () => {
    const budget = remainingBudget(
      fileHolding({ rate_limits: null, written_at: NOW_SECONDS }),
      NOW_SECONDS
    );

    expect(budget).toStrictEqual({
      kind: "unknown",
      reason: { kind: "no-rate-limits" },
    });
  });
});

describe(formatRemainingBudget, () => {
  it("should print both percentages, both resets and the age when the windows were read", () => {
    const line = formatRemainingBudget(
      {
        ageSeconds: 8,
        kind: "budget",
        windows: [
          {
            kind: "window",
            label: "5h",
            resetsInSeconds: 8000,
            usedPercentage: 23.5,
          },
          {
            kind: "window",
            label: "7d",
            resetsInSeconds: 273_600,
            usedPercentage: 41.2,
          },
        ],
      },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "budget 5h 24% resets in 2h13m, 7d 41% resets in 3d4h, written 8s ago"
    );
  });

  it("should print a window as unknown when the file carried no numbers for it", () => {
    const line = formatRemainingBudget(
      {
        ageSeconds: 90,
        kind: "budget",
        windows: [
          { kind: "no-window", label: "5h" },
          {
            kind: "window",
            label: "7d",
            resetsInSeconds: 0,
            usedPercentage: 41.2,
          },
        ],
      },
      RATE_LIMITS_PATH
    );

    expect(line).toBe("budget 5h unknown, 7d 41% resets in 0s, written 1m ago");
  });

  it("should print a window as unknown when its reset has passed", () => {
    const line = formatRemainingBudget(
      {
        ageSeconds: 0,
        kind: "budget",
        windows: [
          { kind: "expired", label: "5h" },
          {
            kind: "window",
            label: "7d",
            resetsInSeconds: 273_600,
            usedPercentage: 41.2,
          },
        ],
      },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "budget 5h unknown, that window has reset, 7d 41% resets in 3d4h, written 0s ago"
    );
  });

  it("should name the path when no file was found", () => {
    const line = formatRemainingBudget(
      { kind: "unknown", reason: { kind: "absent" } },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "unknown /home/dev/.claude/rate-limits.json is not there, so no status line has written the account's usage windows on this machine"
    );
  });

  it("should print the age against the threshold when the file is stale", () => {
    const line = formatRemainingBudget(
      { kind: "unknown", reason: { ageSeconds: 900, kind: "stale" } },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "unknown /home/dev/.claude/rate-limits.json is 15m old, past the 2m this command treats as current"
    );
  });

  it("should say no window is live when the file carries none with a reset ahead", () => {
    const line = formatRemainingBudget(
      { kind: "unknown", reason: { kind: "no-windows" } },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "unknown /home/dev/.claude/rate-limits.json carries no five-hour or seven-day window whose reset is still ahead"
    );
  });

  it("should print the detail when the file could not be read", () => {
    const line = formatRemainingBudget(
      {
        kind: "unknown",
        reason: { detail: "EACCES", kind: "unreadable" },
      },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "unknown /home/dev/.claude/rate-limits.json could not be read: EACCES"
    );
  });

  it("should say the file holds no JSON when it could not be parsed", () => {
    const line = formatRemainingBudget(
      { kind: "unknown", reason: { kind: "no-json" } },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "unknown /home/dev/.claude/rate-limits.json holds no JSON"
    );
  });

  it("should say the file holds no written_at when the stamp is missing", () => {
    const line = formatRemainingBudget(
      { kind: "unknown", reason: { kind: "no-written-at" } },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "unknown /home/dev/.claude/rate-limits.json holds no numeric written_at"
    );
  });

  it("should say the file holds no rate_limits when that object is missing", () => {
    const line = formatRemainingBudget(
      { kind: "unknown", reason: { kind: "no-rate-limits" } },
      RATE_LIMITS_PATH
    );

    expect(line).toBe(
      "unknown /home/dev/.claude/rate-limits.json holds no rate_limits object"
    );
  });
});

const HEAD_SHA = "0a2c0f8";

const pullRequest = (state: string, mergeable = "MERGEABLE"): PullRequest => ({
  headRefOid: HEAD_SHA,
  mergeable,
  state,
});

const NO_PULL_REQUEST: PullRequest | undefined = undefined;

describe(prListing, () => {
  it("should report the pull request when the listing holds a complete row", () => {
    const listing = prListing([
      { headRefOid: HEAD_SHA, mergeable: "MERGEABLE", state: "OPEN" },
    ]);

    expect(listing).toStrictEqual({
      kind: "pull-request",
      pullRequest: {
        headRefOid: HEAD_SHA,
        mergeable: "MERGEABLE",
        state: "OPEN",
      },
    });
  });

  it("should report none when the listing is empty", () => {
    const listing = prListing([]);

    expect(listing).toStrictEqual({ kind: "none" });
  });

  it("should report unreadable when the reply is not a listing", () => {
    const listing = prListing({ message: "Not Found" });

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row is not an object", () => {
    const listing = prListing(["feat/a"]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row is null", () => {
    const listing = prListing([null]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row has no headRefOid", () => {
    const listing = prListing([{ mergeable: "MERGEABLE", state: "OPEN" }]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row's headRefOid is not a string", () => {
    const listing = prListing([
      { headRefOid: 1, mergeable: "MERGEABLE", state: "OPEN" },
    ]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row has no mergeable", () => {
    const listing = prListing([{ headRefOid: HEAD_SHA, state: "OPEN" }]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row's mergeable is not a string", () => {
    const listing = prListing([
      { headRefOid: HEAD_SHA, mergeable: 1, state: "OPEN" },
    ]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row has no state", () => {
    const listing = prListing([
      { headRefOid: HEAD_SHA, mergeable: "MERGEABLE" },
    ]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });

  it("should report unreadable when the row's state is not a string", () => {
    const listing = prListing([
      { headRefOid: HEAD_SHA, mergeable: "MERGEABLE", state: 1 },
    ]);

    expect(listing).toStrictEqual({ kind: "unreadable" });
  });
});

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

  it("should return undefined when an argument holds a double dot", () => {
    const branches = branchNames(["feat/a..b"]);

    expect(branches).toBeUndefined();
  });

  it("should return undefined when a component of an argument starts with a dot", () => {
    const branches = branchNames(["feat/.hidden"]);

    expect(branches).toBeUndefined();
  });

  it("should return undefined when a component of an argument ends with .lock", () => {
    const branches = branchNames(["feat/a.lock"]);

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
  it("should return undefined when the holder holds the branch commits", () => {
    const reason = ancestryKeepReason({ kind: "ancestor" }, "main");

    expect(reason).toBeUndefined();
  });

  it("should name the holder when the branch holds a commit the holder does not", () => {
    const reason = ancestryKeepReason({ kind: "not-ancestor" }, "main");

    expect(reason).toBe("commits main does not hold");
  });

  it("should name the commit when the repository does not have the holder's", () => {
    const reason = ancestryKeepReason(
      { commit: "4b486bc", kind: "absent" },
      "the pull request"
    );

    expect(reason).toBe(
      "the pull request is at commit 4b486bc, which this repository does not have"
    );
  });

  it("should name the failure when the ancestry check could not run", () => {
    const reason = ancestryKeepReason(
      { kind: "failed", reason: "fatal: not a git repository" },
      "main"
    );

    expect(reason).toBe(
      "git could not compare with main: fatal: not a git repository"
    );
  });
});

describe(worktreeVerdict, () => {
  it("should remove the worktree when its branch has no pull request and main holds its commits", () => {
    const verdict = worktreeVerdict({
      kind: "no-pull-request",
      mainAncestry: { kind: "ancestor" },
    });

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should keep the worktree when its branch has no pull request and holds a commit main does not", () => {
    const verdict = worktreeVerdict({
      kind: "no-pull-request",
      mainAncestry: { kind: "not-ancestor" },
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "no pull request, commits main does not hold",
    });
  });

  it("should keep the worktree when its branch has no pull request and the ancestry check could not run", () => {
    const verdict = worktreeVerdict({
      kind: "no-pull-request",
      mainAncestry: { kind: "failed", reason: "fatal: bad revision" },
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason:
        "no pull request, git could not compare with main: fatal: bad revision",
    });
  });

  it("should keep the worktree when its pull request is still open", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "not-ancestor" },
      pullRequest: pullRequest("OPEN"),
      pullRequestAncestry: { kind: "ancestor" },
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason: "pull request OPEN",
    });
  });

  it("should keep the worktree naming both holders when neither the pull request nor main holds its branch commits", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "not-ancestor" },
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
      pullRequestAncestry: { kind: "not-ancestor" },
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason:
        "commits the pull request does not hold, and commits main does not hold",
    });
  });

  it("should keep the worktree when the pull request's commit is not in this repository and main holds no branch commit", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "not-ancestor" },
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
      pullRequestAncestry: { commit: "4b486bc", kind: "absent" },
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason:
        "the pull request is at commit 4b486bc, which this repository does not have, and commits main does not hold",
    });
  });

  it("should keep the worktree when git could not compare its branch with either commit", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "failed", reason: "fatal: bad revision" },
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
      pullRequestAncestry: {
        kind: "failed",
        reason: "fatal: Not a valid commit name 4b486bc",
      },
    });

    expect(verdict).toStrictEqual({
      kind: "keep",
      reason:
        "git could not compare with the pull request: fatal: Not a valid commit name 4b486bc, and git could not compare with main: fatal: bad revision",
    });
  });

  it("should remove the worktree when its pull request is merged and holds its branch commits", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "not-ancestor" },
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
      pullRequestAncestry: { kind: "ancestor" },
    });

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should remove the worktree when its pull request is closed and holds its branch commits", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "not-ancestor" },
      pullRequest: pullRequest("CLOSED", "UNKNOWN"),
      pullRequestAncestry: { kind: "ancestor" },
    });

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should remove the worktree when main holds its branch commits and the pull request does not", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "ancestor" },
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
      pullRequestAncestry: { kind: "not-ancestor" },
    });

    expect(verdict).toStrictEqual({ kind: "remove" });
  });

  it("should remove the worktree when main holds its branch commits and the pull request's commit is not in this repository", () => {
    const verdict = worktreeVerdict({
      kind: "pull-request",
      mainAncestry: { kind: "ancestor" },
      pullRequest: pullRequest("MERGED", "UNKNOWN"),
      pullRequestAncestry: { commit: "4b486bc", kind: "absent" },
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
