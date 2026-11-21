#!/usr/bin/env bun

/**
 * ```
 * bun scripts/check/check.entry.ts
 * ```
 *
 * Runs the format, lint and type checks, then the Effect diagnostics
 * `tsconfig.json` configures, and fails when either failed. Both run every
 * time, so one failing run prints every finding of both.
 */

import { spawnSync } from "node:child_process";

const CHECKS = [
  ["vp", ["check"]],
  [
    "effect-tsgo",
    [
      "diagnostics",
      "--project",
      "tsconfig.json",
      "--strict",
      "--severity",
      "error,warning",
      "--format",
      "text",
    ],
  ],
] as const;

const failed = CHECKS.map(
  ([command, args]) => spawnSync(command, args, { stdio: "inherit" }).status
).filter((status) => status !== 0);

process.exit(failed.length === 0 ? 0 : 1);
