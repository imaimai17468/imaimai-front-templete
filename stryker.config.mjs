import { coverageExclude, coverageInclude } from "./vitest.config.mts";

// The files mutated are the files the coverage gate measures, so a module
// held to 100% branch coverage is also the one whose assertions are tested.
export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.mts" },
  mutate: [
    ...coverageInclude,
    ...coverageExclude.map((pattern) => `!${pattern}`),
    // `**` does not descend into a directory whose name starts with a dot, so
    // the test files under `.claude/` and `.github/` take a pattern of their own.
    "!**/*.test.ts",
    "!{.claude,.github}/**/*.test.ts",
    // A `*.content.ts` module holds page copy alone, so its mutants change
    // the text rather than what the code does.
    "!src/**/*.content.ts",
  ],
  // Listing `plugins` replaces Stryker's default, so the vitest runner the
  // default loaded is named next to the local ignorer.
  plugins: [
    "@stryker-mutator/vitest-runner",
    "./tools/stryker/ignore-identifiers.ts",
  ],
  ignorers: ["identifiers"],
  // An empty name skips the tsconfig rewrite, which calls a JavaScript API
  // the TypeScript 7 package does not ship. The sandbox copies the whole
  // project, so the relative paths it would rewrite already resolve.
  tsconfigFile: "",
  // Results of mutants whose code and covering tests are unchanged are reused
  // from this file, so a run after a small change tests only that change.
  incremental: true,
  incrementalFile: "reports/stryker-incremental.json",
  // `progress` draws only on a terminal; the append-only form prints a line
  // every ten seconds into a CI log or an agent's shell.
  reporters: ["clear-text", "progress-append-only", "html", "json"],
  // The terminal gets the per-file score table alone. Surviving mutants and
  // per-test results are read from `reports/mutation/mutation.json`.
  clearTextReporter: {
    skipFull: true,
    reportMutants: false,
    reportTests: false,
  },
  tempDirName: ".stryker-tmp",
};
