#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit) hook:
# Lint the edited file (scoped, blocking). Whole-project typecheck / lint /
# format stay in the Stop gate — running them per edit re-checked the world
# N times per task and blocked legitimate mid-refactor states.
#
# This hook deliberately does NOT clear .claude/.review-stamp (ADR-0019,
# amending ADR-0013). Clearing it on every edit made fixing a finding require a
# second review, which is the loop that made reviewing expensive. The review is
# one pass: find, verify, fix, done. The stamp's lifetime is bounded by the two
# remaining clears — the next code-reviewer dispatch
# (pre-agent-review-clear.sh) and the next aegis cycle
# (pre-aegis-compile-guard.sh).

set -uo pipefail

INPUT=$(cat)

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# --- Scoped lint on the edited file ---
F=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""')
case "$F" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac
[ -f "$F" ] || exit 0

cd "$ROOT"
OUT=$(bunx oxlint --type-aware "$F" 2>&1)
RC=$?
if [ $RC -ne 0 ]; then
  printf '%s' "$OUT" | jq -Rs --arg file "$F" '{
    systemMessage: ("⛔ PostToolUse block: lint failed — " + $file),
    decision: "block",
    reason: ("PostToolUse: lint failed for the edited file. Fix before the next tool call.\n\n" + .)
  }'
fi
exit 0
