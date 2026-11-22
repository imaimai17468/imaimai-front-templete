#!/usr/bin/env bun

/**
 * ```
 * git diff -z --name-only <base commit> HEAD | bun .github/scripts/mutation-gate/list-changed-modules.entry.ts
 * ```
 *
 * Prints, comma-separated for `stryker run --mutate`, the files read from
 * stdin that `reports/mutation/mutation.json` lists as mutated. Prints an
 * empty line when there are none or the report cannot be read.
 */

import { readFileSync } from "node:fs";
import {
  listChangedModules,
  parseChangedFiles,
  readReportFile,
} from "./mutation-gate.ts";

const modules = listChangedModules(
  readReportFile(
    new URL("../../../reports/mutation/mutation.json", import.meta.url)
  ),
  parseChangedFiles(readFileSync(0, "utf-8"))
);
console.log(modules.join(","));
