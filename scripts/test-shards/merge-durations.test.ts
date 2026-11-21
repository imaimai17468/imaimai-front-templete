// @vitest-environment node

import { describe, expect, it } from "vite-plus/test";
import { mergeDurations } from "./merge-durations";

const resultsOf = (
  files: Record<string, { duration: number; lastRun: number }>,
  project = ""
) => ({
  projects: {
    [project]: {
      files: Object.fromEntries(
        Object.entries(files).map(([path, entry]) => [
          path,
          { ...entry, failed: false },
        ])
      ),
    },
  },
  version: 1,
});

const textOf = (...args: Parameters<typeof resultsOf>) =>
  JSON.stringify(resultsOf(...args));

describe(mergeDurations, () => {
  it("should keep the files of every shard when the shards ran different files", () => {
    expect(
      mergeDurations([
        textOf({ "a.test.ts": { duration: 5, lastRun: 2 } }),
        textOf({ "b.test.ts": { duration: 7, lastRun: 2 } }),
      ])
    ).toStrictEqual({
      kind: "merged",
      results: resultsOf({
        "a.test.ts": { duration: 5, lastRun: 2 },
        "b.test.ts": { duration: 7, lastRun: 2 },
      }),
    });
  });

  it("should keep the most recent run when two shards hold the same file", () => {
    const merged = mergeDurations([
      textOf({ "a.test.ts": { duration: 5, lastRun: 9 } }),
      textOf({ "a.test.ts": { duration: 1, lastRun: 3 } }),
      textOf({ "a.test.ts": { duration: 8, lastRun: 12 } }),
    ]);
    expect(merged).toStrictEqual({
      kind: "merged",
      results: resultsOf({ "a.test.ts": { duration: 8, lastRun: 12 } }),
    });
  });

  it("should keep projects apart when the shards hold different projects", () => {
    const merged = mergeDurations([
      textOf({ "a.test.ts": { duration: 5, lastRun: 2 } }, "web"),
      textOf({ "b.test.ts": { duration: 7, lastRun: 2 } }, "node"),
    ]);
    expect(merged).toMatchObject({
      kind: "merged",
      results: {
        projects: {
          node: { files: { "b.test.ts": { duration: 7 } } },
          web: { files: { "a.test.ts": { duration: 5 } } },
        },
      },
    });
  });

  it("should report empty when no results are given", () => {
    expect(mergeDurations([])).toStrictEqual({
      detail: "No results.json was given to merge.",
      kind: "empty",
    });
  });

  it("should report malformed when a results file lacks the projects map", () => {
    expect(mergeDurations([JSON.stringify({ version: 1 })])).toMatchObject({
      kind: "malformed",
    });
  });

  it("should report malformed when a results file is not JSON", () => {
    expect(mergeDurations(["{"])).toStrictEqual({
      detail: "A results.json is not JSON.",
      kind: "malformed",
    });
  });
});
