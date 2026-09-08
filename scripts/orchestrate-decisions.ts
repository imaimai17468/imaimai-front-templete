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
