#!/usr/bin/env bun

/**
 * ```
 * bun scripts/audit-dependencies.entry.ts
 * ```
 *
 * Runs `bun audit --json` and exits non-zero when an advisory names a direct
 * dependency or when the audit printed no advisory report.
 */

import { spawnSync } from "node:child_process";
import manifest from "../package.json" with { type: "json" };
import {
  auditOutcome,
  auditReportLines,
  directDependencyNames,
} from "./dependency-audit";

const audit = spawnSync(process.execPath, ["audit", "--json"], {
  encoding: "utf-8",
});

const report = auditReportLines(
  auditOutcome(
    {
      exitCode: audit.status,
      spawnError: audit.error?.message,
      stderr: audit.stderr,
      stdout: audit.stdout,
    },
    directDependencyNames(manifest)
  )
);

console.log(report.lines.join("\n"));
process.exit(report.exitCode);
