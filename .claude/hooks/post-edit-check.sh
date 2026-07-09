#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit) hook (ADR-0013):
# 1. Clear .claude/.review-stamp — any edit invalidates a completed review, so
#    post-review fixes require a re-review before committing. This runs for
#    every edited file (including docs: the reviewed diff changed either way)
#    and also in sidechains (a subagent's edit changes the same worktree).
# 2. Lint the edited file (scoped, blocking). Whole-project typecheck / lint /
#    format stay in the Stop gate — running them per edit re-checked the world
#    N times per task and blocked legitimate mid-refactor states.

set -uo pipefail

INPUT=$(cat)

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# --- 1. Review stamp invalidation ---
rm -f "$ROOT/.claude/.review-stamp"

# --- 2. Scoped lint on the edited file ---
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
