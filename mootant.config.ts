import { vitestAdapter } from "mootant/vitest";

export default {
  run: {
    // Tries several mutants in one test run. On this repository its verdicts
    // matched a run without it mutant for mutant, at about 70% of the time.
    fast: true,
    runner: vitestAdapter({ config: "vitest.config.mts" }),
  },
};
