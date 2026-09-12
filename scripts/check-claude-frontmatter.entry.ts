#!/usr/bin/env bun

/**
 * ```
 * bun scripts/check-claude-frontmatter.entry.ts         # this repository
 * bun scripts/check-claude-frontmatter.entry.ts <root>  # a tree holding .claude/
 * ```
 *
 * Exits non-zero when any rule, agent, or skill frontmatter fails to parse,
 * which `claude-frontmatter.ts` decides and prints.
 */

import { main } from "./claude-frontmatter";

process.exit(main(process.argv.slice(2)));
