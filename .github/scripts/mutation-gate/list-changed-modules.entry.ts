#!/usr/bin/env bun

/**
 * ```
 * git diff -z --name-only <base commit> HEAD | bun .github/scripts/mutation-gate/list-changed-modules.entry.ts
 * ```
 *
 * Prints, one per line for `bun run mutate`, the files read from stdin that
 * mutation testing mutates. Prints nothing when there are none.
 */

import { readFileSync } from "node:fs";
import { listChangedModules, parseChangedFiles } from "./mutation-gate.ts";

const modules = listChangedModules(parseChangedFiles(readFileSync(0, "utf-8")));
if (modules.length > 0) {
  console.log(modules.join("\n"));
}
