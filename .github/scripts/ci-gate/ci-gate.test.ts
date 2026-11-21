// @vitest-environment node

import { describe, expect, it } from "vite-plus/test";
import { gateCoverage, gateCoverageReport } from "./ci-gate";

describe(gateCoverage, () => {
  it("should report covered when the gate's needs list every other job", () => {
    expect(
      gateCoverage(
        { jobs: { build: { needs: ["lint", "test"] }, lint: {}, test: {} } },
        "build"
      )
    ).toStrictEqual({ kind: "covered" });
  });

  it("should report covered when needs is written as one string", () => {
    expect(
      gateCoverage({ jobs: { build: { needs: "lint" }, lint: {} } }, "build")
    ).toStrictEqual({ kind: "covered" });
  });

  it("should name each job when the gate does not wait on it", () => {
    expect(
      gateCoverage(
        { jobs: { build: { needs: ["lint"] }, lint: {}, smoke: {}, test: {} } },
        "build"
      )
    ).toStrictEqual({ jobs: ["smoke", "test"], kind: "jobs-missing" });
  });

  it("should name every job when the gate has no needs", () => {
    expect(
      gateCoverage({ jobs: { build: {}, lint: {} } }, "build")
    ).toStrictEqual({ jobs: ["lint"], kind: "jobs-missing" });
  });

  it("should report gate-missing when no job has the gate's name", () => {
    expect(gateCoverage({ jobs: { lint: {} } }, "build")).toStrictEqual({
      kind: "gate-missing",
    });
  });

  it("should report malformed when the jobs cannot be read", () => {
    expect(gateCoverage({ jobs: "none" }, "build")).toMatchObject({
      kind: "malformed",
    });
  });
});

describe(gateCoverageReport, () => {
  it.each([
    {
      coverage: { kind: "covered" } as const,
      expected: { exitCode: 0, message: "build waits on every job." },
    },
    {
      coverage: { detail: "bad", kind: "malformed" } as const,
      expected: {
        exitCode: 1,
        message: "The workflow has no readable jobs map: bad",
      },
    },
    {
      coverage: { kind: "gate-missing" } as const,
      expected: {
        exitCode: 1,
        message: "The workflow has no job named build.",
      },
    },
    {
      coverage: { jobs: ["smoke", "test"], kind: "jobs-missing" } as const,
      expected: {
        exitCode: 1,
        message: "build does not wait on: smoke, test. Add them to its needs.",
      },
    },
  ])(
    "should exit $expected.exitCode when coverage is $coverage.kind",
    ({ coverage, expected }) => {
      expect(gateCoverageReport(coverage, "build")).toStrictEqual(expected);
    }
  );
});
