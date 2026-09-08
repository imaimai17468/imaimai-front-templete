#!/usr/bin/env bun

/**
 * ```
 * bun scripts/check-cursor-rule-mirrors.ts         # this repository
 * bun scripts/check-cursor-rule-mirrors.ts <root>  # a tree holding both directories
 * ```
 *
 * Exits non-zero when any mirror has stopped mirroring its rule, which
 * `cursor-rule-mirrors.ts` decides and prints.
 */

import { main } from "./cursor-rule-mirrors";

process.exit(main(process.argv.slice(2)));
