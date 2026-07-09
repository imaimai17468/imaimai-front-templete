#!/usr/bin/env bash
# SessionStart hook (ADR-0013): environment validation + session marker reset.
#
# The enforcement stack assumes tools that not every machine has (similarity-ts
# binary, Aegis MCP server, plugin-provided skills). Gates that silently skip a
# missing dependency create sessions whose guarantees differ by machine with no
# signal. This hook makes the degrade visible at session start.
#
# It also clears per-session gate markers so a previous session's state can
# never leak into this one:
#   .aegis-stamp        — consultation window marker (per prompt)
#   .aegis-unavailable  — self-declared Aegis degrade (per session)
#   .review-stamp       — review gate (a new session must re-review)

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

rm -f "$ROOT/.claude/.aegis-stamp" "$ROOT/.claude/.aegis-unavailable" "$ROOT/.claude/.review-stamp"

MISSING=()

command -v jq >/dev/null 2>&1 || MISSING+=("jq (ALL guard hooks parse their input with jq — the gates are effectively OFF)")
command -v bun >/dev/null 2>&1 || MISSING+=("bun (per-edit lint and the Stop quality gate cannot run)")
[ -x "$HOME/.cargo/bin/similarity-ts" ] || command -v similarity-ts >/dev/null 2>&1 || MISSING+=("similarity-ts (Stop gate skips duplicate-type/function detection; install: cargo install similarity-ts)")

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "[env-check] This session runs DEGRADED — missing gate dependencies:"
  printf '  - %s\n' "${MISSING[@]}"
  echo "[env-check] Per AGENTS.md 'Degraded environments': state the degrade to the user once, and do not treat skipped checks as passed."
else
  echo "[env-check] Gate dependencies present (jq, bun, similarity-ts)."
fi

echo "[env-check] Note: MCP tools (aegis) and plugin skills (superpowers) cannot be probed from shell. If aegis_compile_context is not in your tool list, follow AGENTS.md 'Degraded environments' (.claude/.aegis-unavailable marker)."

exit 0
