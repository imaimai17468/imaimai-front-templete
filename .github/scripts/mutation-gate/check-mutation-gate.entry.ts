#!/usr/bin/env bun

/**
 * ```
 * git diff -z --name-only <base commit> HEAD | bun .github/scripts/mutation-gate/check-mutation-gate.entry.ts <report>
 * ```
 *
 * Reads the files a pull request changed from stdin and exits non-zero when
 * `<report>`, the JSON `bun run mutate --json` printed, holds a mutant no test
 * notices in one of them, or when that report is missing or unreadable.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  buildGateReport,
  decideMutationGate,
  parseChangedFiles,
  readReportFile,
} from "./mutation-gate.ts";

const report = buildGateReport(
  decideMutationGate(
    readReportFile(pathToFileURL(process.argv[2] ?? "")),
    parseChangedFiles(readFileSync(0, "utf-8"))
  )
);
console.log(report.lines.join("\n"));
process.exit(report.exitCode);
