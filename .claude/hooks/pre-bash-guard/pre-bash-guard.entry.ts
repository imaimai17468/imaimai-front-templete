#!/usr/bin/env bun

/**
 * PreToolUse entry for Bash (Claude Code) and Shell (Cursor) calls: read the
 * command text on stdin and print the decision `hookOutput` returns.
 */

import { readFileSync } from "node:fs";
import { hookOutput } from "./pre-bash-guard-decision.ts";

const STDIN = 0;

const printed = hookOutput(readFileSync(STDIN, "utf-8"));
if (printed !== "") {
  console.log(printed);
}
