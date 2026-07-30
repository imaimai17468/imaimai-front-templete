#!/usr/bin/env bash
# SessionStart hook (ADR-0013): environment validation + session marker reset.
#
# The enforcement stack assumes tools that not every machine has (similarity-ts
# binary, python3, Aegis MCP server, plugin-provided skills). Gates that silently
# skip a missing dependency create sessions whose guarantees differ by machine
# with no signal. This hook makes the degrade visible at session start.
#
# It also clears every per-session gate marker so a previous session's state can
# never leak into this one — the aegis consultation window and degrade markers,
# and all four markers of the review cycle (`.review-stamp` plus the three the
# finder→verifier pairing uses). The rule is "every marker under .claude/ that a
# hook creates", not this list: enumerating them here is how one gets forgotten
# when a fifth is added. They are the `.claude/.*` entries in .gitignore.

set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

rm -f \
  "$ROOT/.claude/.aegis-stamp" \
  "$ROOT/.claude/.aegis-unavailable" \
  "$ROOT/.claude/.review-stamp" \
  "$ROOT/.claude/.finder-done" \
  "$ROOT/.claude/.finder-hash" \
  "$ROOT/.claude/.pair-ok"

MISSING=()

command -v jq >/dev/null 2>&1 || MISSING+=("jq (ALL guard hooks parse their input with jq — the gates are effectively OFF)")
command -v bun >/dev/null 2>&1 || MISSING+=("bun (per-edit lint and the Stop quality gate cannot run)")
[ -x "$HOME/.cargo/bin/similarity-ts" ] || command -v similarity-ts >/dev/null 2>&1 || MISSING+=("similarity-ts (Stop gate skips duplicate-type/function detection; install: cargo install similarity-ts)")
command -v python3 >/dev/null 2>&1 || MISSING+=("python3 (Stop gate skips the markdown dead-link check; the gate-behaviour test scripts under scripts/ cannot run either)")

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "[env-check] This session runs DEGRADED — missing gate dependencies:"
  printf '  - %s\n' "${MISSING[@]}"
  echo "[env-check] Per AGENTS.md 'Degraded environments': state the degrade to the user once, and do not treat skipped checks as passed."
else
  echo "[env-check] Gate dependencies present (jq, bun, similarity-ts, python3)."
fi

echo "[env-check] Note: MCP tools (aegis) and plugin skills (superpowers) cannot be probed from shell. If aegis_compile_context is not in your tool list, follow AGENTS.md 'Degraded environments' (.claude/.aegis-unavailable marker)."

# Model continuity (AGENTS.md, ADR-0014): surface the session model so a
# non-strongest parent is visible from turn one. SessionStart is the only
# hook event that receives `model`, and it is optional; mid-session model
# switches fire no hook at all — this check catches session start only.
MODEL=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  MODEL="$(printf '%s' "$INPUT" | jq -r '.model // empty' 2>/dev/null)"
fi
if [ -n "$MODEL" ]; then
  echo "[env-check] Session model: $MODEL"
  case "$(printf '%s' "$MODEL" | tr '[:upper:]' '[:lower:]')" in
    *fable*) : ;;
    *) echo "[env-check] Parent model is not the strongest tier — AGENTS.md 'Model continuity (non-Fable parent)' applies: escalate design judgment, verify more. Mid-session model switches are NOT detectable by hooks; re-check /model if in doubt." ;;
  esac
else
  echo "[env-check] Session model not reported by the harness. If this session is not on the strongest available model, AGENTS.md 'Model continuity (non-Fable parent)' applies."
fi

exit 0
