import path from "node:path";
import { parseArgs } from "node:util";
import { coverageExclude, coverageInclude } from "../../vitest.config.mts";

/**
 * The files the coverage gate measures, so a module held to 100% branch
 * coverage is also the one whose assertions are tested.
 */
const MUTATED = coverageInclude;

const NOT_MUTATED = [
  ...coverageExclude,
  // A declaration file holds types alone, which have nothing to mutate.
  "**/*.d.ts",
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

/** The `mootant run` options that take a value, so the value is kept with its flag. */
const VALUED_OPTIONS = {
  concurrency: { type: "string" },
  config: { type: "string" },
  mutant: { type: "string" },
  preset: { type: "string" },
  since: { type: "string" },
  threshold: { type: "string" },
} as const;

/** The tracked files under `named` when it names a directory, else `named`. */
const filesNamed = (
  named: string,
  trackedFiles: readonly string[]
): readonly string[] => {
  const directory = `${named.replace(/\/$/u, "")}/`;
  const under = trackedFiles.filter((file) => file.startsWith(directory));
  return under.length > 0 ? under : [named];
};

/**
 * The `mootant run` arguments for `bun run mutate <argv>`: the files `argv`
 * names, or the tracked files under a directory it names, that are mutated,
 * or every mutated tracked file when it names none, followed by the flags
 * `argv` passes through.
 */
export const mutateCommand = (
  argv: readonly string[],
  trackedFiles: readonly string[]
): MutateCommand => {
  const { positionals, tokens } = parseArgs({
    allowPositionals: true,
    args: [...argv],
    options: VALUED_OPTIONS,
    strict: false,
    tokens: true,
  });
  const flags = tokens.flatMap((token) => {
    if (token.kind !== "option") {
      return [];
    }
    return token.value === undefined
      ? [token.rawName]
      : [token.rawName, token.value];
  });
  const named = positionals.flatMap((arg) => filesNamed(arg, trackedFiles));
  const targets = mutationTargets(named.length > 0 ? named : trackedFiles);
  if (targets.length === 0) {
    return {
      kind: "nothing",
      reason: "None of these files is mutated, so there is nothing to run.",
    };
  }
  return { args: ["run", ...targets, ...flags], kind: "run" };
};
