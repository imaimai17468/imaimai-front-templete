/**
 * Which tracked files mutation testing mutates. `mutate.entry.ts` and the CI
 * gate both read the list from here, so a file is either mutated everywhere
 * or nowhere.
 */

import path from "node:path";
import { coverageExclude, coverageInclude } from "../../vitest.config.mts";

/**
 * The files the coverage gate measures, so a module held to 100% branch
 * coverage is also the one whose assertions are tested.
 */
const MUTATED = coverageInclude;

const NOT_MUTATED = [
  ...coverageExclude,
  // `**` does not descend into a directory whose name starts with a dot, so
  // the test files under `.claude/` and `.github/` take a pattern of their own.
  "**/*.test.ts",
  "{.claude,.github}/**/*.test.ts",
  // A `*.content.ts` module holds page copy alone, so its mutants change the
  // text rather than what the code does.
  "src/**/*.content.ts",
];

const matchesAny = (file: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => path.matchesGlob(file, pattern));

/** The files among `files` that mutation testing mutates, in their order. */
export const mutationTargets = (files: readonly string[]): readonly string[] =>
  files.filter(
    (file) => matchesAny(file, MUTATED) && !matchesAny(file, NOT_MUTATED)
  );

export type MutateCommand =
  | { readonly kind: "run"; readonly args: readonly string[] }
  | { readonly kind: "nothing"; readonly reason: string };

const isFlag = (arg: string): boolean => arg.startsWith("-");

/**
 * The `mootant run` arguments for `bun run mutate <argv>`: the files `argv`
 * names that are mutated, or every mutated tracked file when it names none,
 * followed by the flags `argv` passes through.
 */
export const mutateCommand = (
  argv: readonly string[],
  trackedFiles: readonly string[]
): MutateCommand => {
  const named = argv.filter((arg) => !isFlag(arg));
  const flags = argv.filter(isFlag);
  const targets = mutationTargets(named.length > 0 ? named : trackedFiles);
  if (targets.length === 0) {
    return {
      kind: "nothing",
      reason: "None of these files is mutated, so there is nothing to run.",
    };
  }
  return { args: ["run", ...targets, ...flags], kind: "run" };
};
