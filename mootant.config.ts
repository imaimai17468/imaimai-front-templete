import { vitestAdapter } from "mootant/vitest";

export default {
  run: {
    // Tries several mutants in one test run, which is faster, and a kill can
    // come from state an earlier try left behind.
    fast: true,
    runner: vitestAdapter({ config: "vitest.config.mts" }),
  },
};
