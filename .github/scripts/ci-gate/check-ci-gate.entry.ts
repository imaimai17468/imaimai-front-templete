#!/usr/bin/env bun

/**
 * ```
 * bun .github/scripts/ci-gate/check-ci-gate.entry.ts
 * ```
 *
 * Exits non-zero when the `build` job of the CI workflow does not wait on
 * every other job in it.
 */

import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { gateCoverage, gateCoverageReport } from "./ci-gate.ts";

const GATE_JOB = "build";

const workflow: unknown = parse(
  readFileSync(new URL("../../workflows/ci.yaml", import.meta.url), "utf-8")
);

const report = gateCoverageReport(gateCoverage(workflow, GATE_JOB), GATE_JOB);
console.log(report.message);
process.exit(report.exitCode);
