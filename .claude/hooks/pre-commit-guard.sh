#!/usr/bin/env bash
# PreToolUse(Bash) guard for git commit:
# Block if .review-stamp is missing (review gate)

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')
case "$CMD" in
  *git\ commit*|*git\ -c\ *commit*) ;;
  *) exit 0 ;;
esac

# Skip in subagent (sidechain) sessions.
SIDECHAIN_CHECK=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$SIDECHAIN_CHECK" ] && [ -f "$SIDECHAIN_CHECK" ]; then
  if head -1 "$SIDECHAIN_CHECK" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# --- Guard: review stamp must exist ---
if [ ! -f "$ROOT/.claude/.review-stamp" ]; then
  jq -n '{
    decision: "block",
    reason: "PreToolUse(Bash): the review gate has not been stamped. Run /review-diff — or dispatch the code-reviewer agent — on the uncommitted diff before committing."
  }'
  exit 0
fi

exit 0
