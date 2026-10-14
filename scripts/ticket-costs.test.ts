import { describe, expect, it } from "vite-plus/test";
import type { RemainingBudget } from "./orchestrate-decisions";
import {
  costLog,
  dispatchEvent,
  doneEvent,
  fiveHourSnapshot,
  formatCosts,
} from "./ticket-costs";
import type { CostEvent, DispatchEvent, DoneEvent } from "./ticket-costs";

const NOW = 1_791_964_866;
const RESETS_AT = NOW + 3600;
const LOG_PATH = "/repo/.claude/ticket-costs.jsonl";
const RECORD_DISPATCH_USAGE =
  "usage: bun scripts/orchestrate.ts record-dispatch";
const RECORD_DONE_USAGE = "usage: bun scripts/orchestrate.ts record-done";

const budget = (
  windows: Extract<RemainingBudget, { kind: "budget" }>["windows"]
): RemainingBudget => ({ ageSeconds: 5, kind: "budget", windows });

describe(fiveHourSnapshot, () => {
  it("should turn the reset countdown into an epoch second when the five-hour window is readable", () => {
    const snapshot = fiveHourSnapshot(
      budget([
        {
          kind: "window",
          label: "5h",
          resetsInSeconds: 3600.4,
          usedPercentage: 31,
        },
      ]),
      NOW
    );

    expect(snapshot).toStrictEqual({
      resets_at: RESETS_AT,
      used_percentage: 31,
    });
  });

  it("should return undefined when the budget is unknown", () => {
    expect(
      fiveHourSnapshot({ kind: "unknown", reason: { kind: "absent" } }, NOW)
    ).toBeUndefined();
  });

  it("should return undefined when only the seven-day window is readable", () => {
    const snapshot = fiveHourSnapshot(
      budget([
        { kind: "no-window", label: "5h" },
        {
          kind: "window",
          label: "7d",
          resetsInSeconds: 90_000,
          usedPercentage: 40,
        },
      ]),
      NOW
    );

    expect(snapshot).toBeUndefined();
  });

  it("should return undefined when the five-hour window has reset", () => {
    expect(
      fiveHourSnapshot(budget([{ kind: "expired", label: "5h" }]), NOW)
    ).toBeUndefined();
  });
});

const WINDOW = { resets_at: RESETS_AT, used_percentage: 31 };

describe(dispatchEvent, () => {
  it("should build the event with the window when every argument is valid", () => {
    expect(
      dispatchEvent(["feat/a", "opus", "high", "gate"], NOW, WINDOW)
    ).toStrictEqual({
      kind: "ok",
      value: {
        at: NOW,
        branch: "feat/a",
        effort: "high",
        event: "dispatch",
        kind: "gate",
        model: "opus",
        window: WINDOW,
      },
    });
  });

  it("should leave the window out when none was read", () => {
    expect(
      dispatchEvent(["feat/a", "fable", "max", "judgment"], NOW)
    ).toStrictEqual({
      kind: "ok",
      value: {
        at: NOW,
        branch: "feat/a",
        effort: "max",
        event: "dispatch",
        kind: "judgment",
        model: "fable",
      },
    });
  });

  it.each([
    [[], RECORD_DISPATCH_USAGE],
    [["", "opus", "high", "gate"], RECORD_DISPATCH_USAGE],
    [["feat/a", "opus", "high"], RECORD_DISPATCH_USAGE],
    [["feat/a", "gpt", "high", "gate"], "model must be one of"],
    [["feat/a", "opus", "huge", "gate"], "effort must be one of"],
    [["feat/a", "opus", "high", "docs"], "kind must be one of"],
  ])("should name what is wrong when the arguments are %j", (args, message) => {
    const parsed = dispatchEvent(args, NOW, WINDOW);

    expect(parsed.kind === "error" && parsed.message).toContain(message);
  });
});

describe(doneEvent, () => {
  it("should read the three counts when they are whole numbers", () => {
    expect(
      doneEvent(["feat/a", "101648", "27", "277919"], NOW, WINDOW)
    ).toStrictEqual({
      kind: "ok",
      value: {
        at: NOW,
        branch: "feat/a",
        duration_ms: 277_919,
        event: "done",
        subagent_tokens: 101_648,
        tool_uses: 27,
        window: WINDOW,
      },
    });
  });

  it.each([
    [[], RECORD_DONE_USAGE],
    [["", "1", "2", "3"], RECORD_DONE_USAGE],
    [["feat/a", "1.5", "2", "3"], "must be whole numbers"],
    [["feat/a", "1", "-2", "3"], "must be whole numbers"],
    [["feat/a", "1", "2", "3ms"], "must be whole numbers"],
  ])("should refuse the counts when the arguments are %j", (args, message) => {
    const parsed = doneEvent(args, NOW);

    expect(parsed.kind === "error" && parsed.message).toContain(message);
  });
});

const dispatch = (
  branch: string,
  at: number,
  overrides: Partial<DispatchEvent> = {}
): DispatchEvent => ({
  at,
  branch,
  effort: "high",
  event: "dispatch",
  kind: "gate",
  model: "opus",
  ...overrides,
});

const done = (
  branch: string,
  at: number,
  overrides: Partial<DoneEvent> = {}
): DoneEvent => ({
  at,
  branch,
  duration_ms: 600_000,
  event: "done",
  subagent_tokens: 100_000,
  tool_uses: 40,
  ...overrides,
});

const at = (used: number, resetsAt = RESETS_AT) => ({
  resets_at: resetsAt,
  used_percentage: used,
});

describe(costLog, () => {
  it("should keep each valid event and count the rest when non-blank lines hold no event", () => {
    const text = [
      JSON.stringify(dispatch("feat/a", NOW, { window: at(10) })),
      "",
      "not json",
      JSON.stringify({ branch: "feat/a", event: "done" }),
      JSON.stringify({ ...dispatch("feat/b", NOW), window: { used: 3 } }),
      JSON.stringify(done("feat/a", NOW + 60)),
      JSON.stringify({ event: "other" }),
      "",
    ].join("\n");

    const log = costLog(text);

    expect({
      events: log.events.map((event) => event.event),
      skippedLines: log.skippedLines,
    }).toStrictEqual({ events: ["dispatch", "done"], skippedLines: 4 });
  });
});

const costs = (events: readonly CostEvent[]): readonly string[] =>
  formatCosts(
    costLog(events.map((event) => JSON.stringify(event)).join("\n")),
    LOG_PATH
  );

const UNKNOWN_SOLO = "5h window per ticket unknown, no solo run yet";

const soloLine = (percent: string, solo: number, count = solo): string =>
  `opus gate: tickets ${count}, median 100000 subagent_tokens, 10.0 min, 5h window ${percent}% per ticket over ${solo} solo`;

const unknownLine = (count: number): string =>
  `opus gate: tickets ${count}, median 100000 subagent_tokens, 10.0 min, ${UNKNOWN_SOLO}`;

describe(formatCosts, () => {
  it("should count the window spent when a ticket ran alone inside one window", () => {
    expect(
      costs([
        dispatch("feat/a", NOW, { window: at(10) }),
        done("feat/a", NOW + 600, { window: at(17.25) }),
      ])
    ).toStrictEqual([soloLine("7.3", 1)]);
  });

  it("should leave the window spent unknown when another ticket overlapped it", () => {
    expect(
      costs([
        dispatch("feat/a", NOW, { window: at(10) }),
        dispatch("feat/b", NOW + 100, { window: at(11) }),
        done("feat/a", NOW + 600, { window: at(20) }),
        done("feat/b", NOW + 900, { window: at(25) }),
      ])
    ).toStrictEqual([unknownLine(2)]);
  });

  it("should count back-to-back tickets as solo when one starts as the other ends", () => {
    expect(
      costs([
        dispatch("feat/a", NOW, { window: at(10) }),
        done("feat/a", NOW + 600, { window: at(14) }),
        dispatch("feat/b", NOW + 600, { window: at(14) }),
        done("feat/b", NOW + 900, { window: at(15) }),
      ])
    ).toStrictEqual([soloLine("2.5", 2)]);
  });

  it.each([
    ["the orphan read no window, so it never ends", {}, NOW + 10_000],
    [
      "the orphan read a window that resets after the ticket began",
      { window: at(9) },
      RESETS_AT - 1,
    ],
  ])(
    "should count an orphan dispatch as in flight when %s",
    (_case, orphanWindow, laterDispatch) => {
      expect(
        costs([
          dispatch("feat/orphan", NOW, orphanWindow),
          dispatch("feat/a", laterDispatch, { window: at(10) }),
          done("feat/a", laterDispatch + 600, { window: at(17) }),
        ])
      ).toStrictEqual([unknownLine(1)]);
    }
  );

  it("should stop counting an orphan dispatch as in flight when its branch was dispatched again", () => {
    expect(
      costs([
        dispatch("feat/a", NOW, { window: at(5) }),
        dispatch("feat/a", NOW + 300, { window: at(8) }),
        done("feat/a", NOW + 600, { window: at(10) }),
        dispatch("feat/b", NOW + 600, { window: at(10) }),
        done("feat/b", NOW + 900, { window: at(13) }),
      ])
    ).toStrictEqual([soloLine("2.5", 2)]);
  });

  it("should count the ticket as solo when the orphan's window reset before it began", () => {
    expect(
      costs([
        dispatch("feat/orphan", NOW - 20_000, { window: at(70, NOW - 100) }),
        dispatch("feat/a", NOW, { window: at(10) }),
        done("feat/a", NOW + 600, { window: at(17) }),
      ])
    ).toStrictEqual([soloLine("7.0", 1)]);
  });

  it.each([
    ["the dispatch read no window", undefined, at(17)],
    ["the completion read no window", at(10), undefined],
    ["the window reset in between", at(80), at(3, RESETS_AT + 18_000)],
  ])(
    "should leave the window spent unknown when %s",
    (_case, before, after) => {
      expect(
        costs([
          dispatch(
            "feat/a",
            NOW,
            before === undefined ? {} : { window: before }
          ),
          done(
            "feat/a",
            NOW + 600,
            after === undefined ? {} : { window: after }
          ),
        ])
      ).toStrictEqual([unknownLine(1)]);
    }
  );

  it("should credit the latest earlier dispatch when a branch was dispatched more than once", () => {
    expect(
      costs([
        dispatch("feat/a", NOW, { model: "fable" }),
        dispatch("feat/a", NOW + 300),
        dispatch("feat/a", NOW + 900, { model: "sonnet" }),
        done("feat/a", NOW + 600),
      ])
    ).toStrictEqual([unknownLine(1)]);
  });

  it("should add no ticket when a second notice arrives for the same dispatch", () => {
    expect(
      costs([
        dispatch("feat/a", NOW),
        done("feat/a", NOW + 600),
        done("feat/a", NOW + 1200),
      ])
    ).toStrictEqual([unknownLine(1)]);
  });

  it("should take medians per model and kind when some runs were solo", () => {
    expect(
      costs([
        dispatch("feat/a", NOW, { window: at(10) }),
        done("feat/a", NOW + 100, {
          duration_ms: 60_000,
          subagent_tokens: 300,
          window: at(16),
        }),
        dispatch("feat/b", NOW + 100),
        done("feat/b", NOW + 200, {
          duration_ms: 180_000,
          subagent_tokens: 100,
        }),
        dispatch("feat/c", NOW + 200, { window: at(16) }),
        done("feat/c", NOW + 300, {
          duration_ms: 120_000,
          subagent_tokens: 200,
          window: at(18),
        }),
        dispatch("feat/d", NOW + 300, { window: at(18) }),
        done("feat/d", NOW + 400, {
          duration_ms: 240_000,
          subagent_tokens: 400,
          window: at(22),
        }),
        dispatch("feat/e", NOW + 400, { kind: "judgment", model: "fable" }),
        done("feat/e", NOW + 500, { subagent_tokens: 900 }),
      ])
    ).toStrictEqual([
      "opus gate: tickets 4, median 250 subagent_tokens, 2.5 min, 5h window 4.0% per ticket over 3 solo",
      `fable judgment: tickets 1, median 900 subagent_tokens, 10.0 min, ${UNKNOWN_SOLO}`,
    ]);
  });

  it("should print the skipped count when the log also holds lines without an event", () => {
    const log = costLog(
      [
        JSON.stringify(dispatch("feat/a", NOW)),
        JSON.stringify(done("feat/a", NOW + 600)),
        "garbage",
      ].join("\n")
    );

    expect(formatCosts(log, LOG_PATH)).toStrictEqual([
      unknownLine(1),
      `skipped 1 lines of ${LOG_PATH} that hold no event`,
    ]);
  });

  it("should say no ticket completed when the log holds none", () => {
    expect(formatCosts(costLog(""), LOG_PATH)).toStrictEqual([
      `no completed ticket in ${LOG_PATH} yet`,
    ]);
  });

  it("should drop a completion when no dispatch of its branch precedes it", () => {
    expect(
      costs([dispatch("feat/b", NOW), done("feat/a", NOW + 600)])
    ).toStrictEqual([`no completed ticket in ${LOG_PATH} yet`]);
  });
});
