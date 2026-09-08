#!/usr/bin/env bun

/**
 * The two reads an orchestrating session makes while its workers run, so the
 * session itself never issues a command that could stop on a permission prompt.
 *
 * ```
 * bun scripts/orchestrate.ts free-gib          # free memory in GiB, one number
 * bun scripts/orchestrate.ts watch-prs 12 15   # exits when one of these needs the orchestrator
 * ```
 *
 * `watch-prs` reads each PR with `gh pr view` once a minute and exits with a
 * single line:
 * `conflict <n> ...` when an open PR of the run turns CONFLICTING, or
 * `all-closed` once none of them is open. Run it in the background and start it
 * again after acting on the line.
 */

import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import {
  formatEvent,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  watchEvent,
} from "./orchestrate-decisions";
import type { PrRow } from "./orchestrate-decisions";

const POLL_MS = 60_000;

const run = (file: string, args: readonly string[]): string =>
  execFileSync(file, args, { encoding: "utf-8" });

const freeGib = (): number | undefined => {
  if (process.platform === "darwin") {
    return freeGibFromMemoryPressure(
      run("memory_pressure", []),
      Number(run("sysctl", ["-n", "hw.memsize"]).trim())
    );
  }
  return freeGibFromFreeB(run("free", ["-b"]));
};

const isPrRow = (value: unknown): value is PrRow =>
  typeof value === "object" &&
  value !== null &&
  "number" in value &&
  typeof value.number === "number" &&
  "state" in value &&
  typeof value.state === "string" &&
  "mergeable" in value &&
  typeof value.mergeable === "string";

const prRow = (number: number): PrRow => {
  const parsed: unknown = JSON.parse(
    run("gh", [
      "pr",
      "view",
      String(number),
      "--json",
      "number,state,mergeable",
    ])
  );
  if (!isPrRow(parsed)) {
    throw new Error(
      `gh pr view ${number} returned a shape without number/state/mergeable`
    );
  }
  return parsed;
};

const watchPrs = async (numbers: readonly number[]): Promise<void> => {
  const event = watchEvent(numbers, numbers.map(prRow));
  if (event !== undefined) {
    console.log(formatEvent(event));
    return;
  }
  await delay(POLL_MS);
  await watchPrs(numbers);
};

const [command, ...rest] = process.argv.slice(2);

const usage: (line: string) => never = (line) => {
  console.error(line);
  process.exit(1);
};

if (command === "free-gib") {
  const gib = freeGib();
  if (gib === undefined) {
    usage("could not read free memory from the platform command");
  }
  console.log(gib.toFixed(1));
} else if (command === "watch-prs") {
  const numbers = rest.map(Number);
  if (numbers.length === 0 || numbers.some(Number.isNaN)) {
    usage("usage: bun scripts/orchestrate.ts watch-prs <pr-number>...");
  }
  await watchPrs(numbers);
} else {
  usage(
    "usage: bun scripts/orchestrate.ts <free-gib | watch-prs <pr-number>...>"
  );
}
