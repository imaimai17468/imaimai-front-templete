#!/usr/bin/env bun

/**
 * ```
 * bun scripts/claude-frontmatter/check-claude-frontmatter.entry.ts         # this repository
 * bun scripts/claude-frontmatter/check-claude-frontmatter.entry.ts <root>  # a tree holding .claude/
 * ```
 *
 * Exits non-zero when any rule, agent, or skill frontmatter fails to parse,
 * which `claude-frontmatter.ts` decides.
 */

import {
  frontmatterOutcome,
  frontmatterReport,
  frontmatterRoot,
} from "./claude-frontmatter.ts";

const { exitCode, text } = frontmatterOutcome(
  frontmatterReport(frontmatterRoot(process.argv.slice(2)))
);
console.log(text);
process.exit(exitCode);
