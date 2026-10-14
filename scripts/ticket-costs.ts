/**
 * The decisions behind `record-dispatch`, `record-done` and `ticket-costs` in
 * `orchestrate.ts`: what one log line holds, how a dispatch and its completion
 * pair into a ticket, and what the summary prints. The log is JSON Lines, one
 * event per line, appended and never rewritten, so the pairing is recomputed
 * from every line on each read.
 */

import { isRecord } from "./orchestrate-decisions";
import type { RemainingBudget } from "./orchestrate-decisions";

const MODELS = ["opus", "fable", "sonnet", "haiku"] as const;
export type Model = (typeof MODELS)[number];

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORTS)[number];

/**
 * `gate` is a ticket whose acceptance is a gate's exit code, `judgment` one
 * whose work is finding what a gate cannot check.
 */
const KINDS = ["gate", "judgment"] as const;
export type Kind = (typeof KINDS)[number];

/** The five-hour window at one moment, in the field names the log stores. */
export interface WindowSnapshot {
  readonly resets_at: number;
  readonly used_percentage: number;
}

export interface DispatchEvent {
  readonly at: number;
  readonly branch: string;
  readonly effort: Effort;
  readonly event: "dispatch";
  readonly kind: Kind;
  readonly model: Model;
  readonly window?: WindowSnapshot;
}

export interface DoneEvent {
  readonly at: number;
  readonly branch: string;
  readonly duration_ms: number;
  readonly event: "done";
  readonly subagent_tokens: number;
  readonly tool_uses: number;
  readonly window?: WindowSnapshot;
}

export type CostEvent = DispatchEvent | DoneEvent;

export type Parsed<T> =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "ok"; readonly value: T };

const FIVE_HOUR_LABEL = "5h";

/**
 * The five-hour window `remainingBudget` read, or undefined where it read
 * none, so a line logged while the status line was not writing carries no
 * window rather than a guessed one.
 */
export const fiveHourSnapshot = (
  budget: RemainingBudget,
  nowSeconds: number
): WindowSnapshot | undefined => {
  if (budget.kind === "unknown") {
    return undefined;
  }
  const window = budget.windows.find(
    (reading) => reading.label === FIVE_HOUR_LABEL
  );
  return window?.kind === "window"
    ? {
        resets_at: Math.round(nowSeconds + window.resetsInSeconds),
        used_percentage: window.usedPercentage,
      }
    : undefined;
};

const isOneOf = <T extends string>(
  values: readonly T[],
  value: unknown
): value is T => values.some((candidate) => candidate === value);

const error = <T>(message: string): Parsed<T> => ({ kind: "error", message });

const withWindow = <T extends object>(
  event: T,
  window: WindowSnapshot | undefined
): T & { readonly window?: WindowSnapshot } =>
  window === undefined ? event : { ...event, window };

const RECORD_DISPATCH_USAGE = `usage: bun scripts/orchestrate.ts record-dispatch <branch> <${MODELS.join("|")}> <${EFFORTS.join("|")}> <${KINDS.join("|")}>`;

export const dispatchEvent = (
  args: readonly string[],
  at: number,
  window?: WindowSnapshot
): Parsed<DispatchEvent> => {
  const [branch, model, effort, kind] = args;
  if (args.length !== 4 || branch === undefined || branch === "") {
    return error(RECORD_DISPATCH_USAGE);
  }
  if (!isOneOf(MODELS, model)) {
    return error(`model must be one of ${MODELS.join(", ")}`);
  }
  if (!isOneOf(EFFORTS, effort)) {
    return error(`effort must be one of ${EFFORTS.join(", ")}`);
  }
  if (!isOneOf(KINDS, kind)) {
    return error(`kind must be one of ${KINDS.join(", ")}`);
  }
  return {
    kind: "ok",
    value: withWindow(
      { at, branch, effort, event: "dispatch", kind, model } as const,
      window
    ),
  };
};

const RECORD_DONE_USAGE =
  "usage: bun scripts/orchestrate.ts record-done <branch> <subagent_tokens> <tool_uses> <duration_ms>";

const COUNT = /^\d+$/u;

const count = (value: string | undefined): number | undefined =>
  value !== undefined && COUNT.test(value) ? Number(value) : undefined;

export const doneEvent = (
  args: readonly string[],
  at: number,
  window?: WindowSnapshot
): Parsed<DoneEvent> => {
  const [branch, ...numbers] = args;
  if (args.length !== 4 || branch === undefined || branch === "") {
    return error(RECORD_DONE_USAGE);
  }
  const [subagentTokens, toolUses, durationMs] = numbers.map(count);
  if (
    subagentTokens === undefined ||
    toolUses === undefined ||
    durationMs === undefined
  ) {
    return error(
      "subagent_tokens, tool_uses and duration_ms must be whole numbers, as the Agent completion notice prints them"
    );
  }
  return {
    kind: "ok",
    value: withWindow(
      {
        at,
        branch,
        duration_ms: durationMs,
        event: "done",
        subagent_tokens: subagentTokens,
        tool_uses: toolUses,
      } as const,
      window
    ),
  };
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isWindowSnapshot = (value: unknown): value is WindowSnapshot =>
  isRecord(value) &&
  isFiniteNumber(value.resets_at) &&
  isFiniteNumber(value.used_percentage);

const hasValidWindow = (value: Record<string, unknown>): boolean =>
  value.window === undefined || isWindowSnapshot(value.window);

const isDispatchEvent = (value: unknown): value is DispatchEvent =>
  isRecord(value) &&
  value.event === "dispatch" &&
  typeof value.branch === "string" &&
  isFiniteNumber(value.at) &&
  isOneOf(MODELS, value.model) &&
  isOneOf(EFFORTS, value.effort) &&
  isOneOf(KINDS, value.kind) &&
  hasValidWindow(value);

const isDoneEvent = (value: unknown): value is DoneEvent =>
  isRecord(value) &&
  value.event === "done" &&
  typeof value.branch === "string" &&
  isFiniteNumber(value.at) &&
  isFiniteNumber(value.subagent_tokens) &&
  isFiniteNumber(value.tool_uses) &&
  isFiniteNumber(value.duration_ms) &&
  hasValidWindow(value);

const lineEvent = (line: string): CostEvent | undefined => {
  try {
    const parsed: unknown = JSON.parse(line);
    return isDispatchEvent(parsed) || isDoneEvent(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export interface CostLog {
  readonly events: readonly CostEvent[];
  readonly skippedLines: number;
}

/** Every event the log holds, and how many non-blank lines held none. */
export const costLog = (text: string): CostLog => {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const events = lines.flatMap((line) => {
    const event = lineEvent(line);
    return event === undefined ? [] : [event];
  });
  return { events, skippedLines: lines.length - events.length };
};

interface Ticket {
  readonly durationMs: number;
  readonly kind: Kind;
  readonly model: Model;
  readonly subagentTokens: number;
  /**
   * Percentage points of the five-hour window spent between dispatch and
   * completion, where no other ticket was in flight in that span and the window
   * did not reset. Every other session on the account, the dispatching session
   * among them, spends inside it too.
   */
  readonly windowSpent: number | undefined;
}

interface Span {
  readonly dispatch: DispatchEvent;
  readonly done: DoneEvent;
}

/** Seconds during which a dispatched worker counts as in flight. */
interface InFlight {
  readonly dispatch: DispatchEvent;
  readonly end: number;
}

interface Pairing {
  readonly orphans: readonly DispatchEvent[];
  readonly spans: readonly Span[];
}

/**
 * Walks the events in time order. A completion takes the latest dispatch of
 * its branch that no completion took yet, and one finding none is dropped, so
 * a second notice for the same dispatch adds no ticket.
 */
const pairing = (events: readonly CostEvent[]): Pairing => {
  const open: DispatchEvent[] = [];
  const spans: Span[] = [];
  events
    .toSorted((x, y) => x.at - y.at)
    .forEach((event) => {
      if (event.event === "dispatch") {
        open.push(event);
        return;
      }
      const index = open.findLastIndex(
        (candidate) => candidate.branch === event.branch
      );
      const [dispatch] = index === -1 ? [] : open.splice(index, 1);
      if (dispatch !== undefined) {
        spans.push({ dispatch, done: event });
      }
    });
  return { orphans: open, spans };
};

/**
 * A dispatch with no completion still had a worker running: until its branch
 * was dispatched again, or else until the window it read resets, or else for
 * good.
 */
const orphanEnd = (
  orphan: DispatchEvent,
  events: readonly CostEvent[]
): number =>
  Math.min(
    orphan.window?.resets_at ?? Number.POSITIVE_INFINITY,
    ...events
      .filter(
        (event) =>
          event.event === "dispatch" &&
          event.branch === orphan.branch &&
          event.at > orphan.at
      )
      .map((event) => event.at)
  );

const overlaps = (span: Span, other: InFlight): boolean =>
  span.dispatch.at < other.end && other.dispatch.at < span.done.at;

const soloWindowSpent = (
  span: Span,
  others: readonly InFlight[]
): number | undefined => {
  const before = span.dispatch.window;
  const after = span.done.window;
  if (
    before === undefined ||
    after === undefined ||
    before.resets_at !== after.resets_at ||
    others.some((other) => overlaps(span, other))
  ) {
    return undefined;
  }
  return after.used_percentage - before.used_percentage;
};

const tickets = (events: readonly CostEvent[]): readonly Ticket[] => {
  const { orphans, spans } = pairing(events);
  const inFlight: readonly InFlight[] = [
    ...spans.map((span) => ({ dispatch: span.dispatch, end: span.done.at })),
    ...orphans.map((orphan) => ({
      dispatch: orphan,
      end: orphanEnd(orphan, events),
    })),
  ];
  return spans.map((span) => ({
    durationMs: span.done.duration_ms,
    kind: span.dispatch.kind,
    model: span.dispatch.model,
    subagentTokens: span.done.subagent_tokens,
    windowSpent: soloWindowSpent(
      span,
      inFlight.filter((other) => other.dispatch !== span.dispatch)
    ),
  }));
};

/** The middle value, or the mean of the two middle values of an even count. */
const median = (values: readonly number[]): number => {
  const middle = values
    .toSorted((a, b) => a - b)
    .slice(
      Math.floor((values.length - 1) / 2),
      Math.floor(values.length / 2) + 1
    );
  return middle.reduce((sum, value) => sum + value, 0) / middle.length;
};

interface CostGroup {
  readonly count: number;
  readonly kind: Kind;
  readonly medianDurationMs: number;
  readonly medianSubagentTokens: number;
  readonly model: Model;
  readonly soloCount: number;
  readonly soloMedianWindowSpent: number | undefined;
}

/** One group per model and kind that has a ticket, in `MODELS` × `KINDS` order. */
const costGroups = (all: readonly Ticket[]): readonly CostGroup[] =>
  MODELS.flatMap((model) =>
    KINDS.flatMap((kind): CostGroup[] => {
      const group = all.filter(
        (ticket) => ticket.model === model && ticket.kind === kind
      );
      if (group.length === 0) {
        return [];
      }
      const solo = group.flatMap((ticket) =>
        ticket.windowSpent === undefined ? [] : [ticket.windowSpent]
      );
      return [
        {
          count: group.length,
          kind,
          medianDurationMs: median(group.map((ticket) => ticket.durationMs)),
          medianSubagentTokens: median(
            group.map((ticket) => ticket.subagentTokens)
          ),
          model,
          soloCount: solo.length,
          soloMedianWindowSpent: solo.length === 0 ? undefined : median(solo),
        },
      ];
    })
  );

const MS_PER_MINUTE = 60_000;

const formatGroup = (group: CostGroup): string => {
  const window =
    group.soloMedianWindowSpent === undefined
      ? "5h window per ticket unknown, no solo run yet"
      : `5h window ${group.soloMedianWindowSpent.toFixed(1)}% per ticket over ${group.soloCount} solo`;
  return `${group.model} ${group.kind}: tickets ${group.count}, median ${Math.round(group.medianSubagentTokens)} subagent_tokens, ${(group.medianDurationMs / MS_PER_MINUTE).toFixed(1)} min, ${window}`;
};

/** The lines `ticket-costs` prints. */
export const formatCosts = (log: CostLog, path: string): readonly string[] => {
  const groups = costGroups(tickets(log.events));
  const skipped =
    log.skippedLines === 0
      ? []
      : [`skipped ${log.skippedLines} lines of ${path} that hold no event`];
  return groups.length === 0
    ? [`no completed ticket in ${path} yet`, ...skipped]
    : [...groups.map(formatGroup), ...skipped];
};
