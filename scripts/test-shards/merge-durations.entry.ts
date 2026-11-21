#!/usr/bin/env bun

/**
 * ```
 * bun scripts/test-shards/merge-durations.entry.ts <output> <input>...
 * ```
 *
 * Writes to `<output>` the per-file durations of every `<input>`, each a
 * Vitest `results.json` one test shard left behind.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { mergeDurations } from "./merge-durations.ts";

const [output, ...inputs] = process.argv.slice(2);

if (output === undefined) {
  console.error("usage: merge-durations.entry.ts <output> <input>...");
  process.exit(1);
}

const merged = mergeDurations(
  inputs.map((input) => readFileSync(input, "utf-8"))
);

if (merged.kind !== "merged") {
  console.error(merged.detail);
  process.exit(1);
}

mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(merged.results));
console.log(`Merged ${inputs.length} results.json into ${output}.`);
