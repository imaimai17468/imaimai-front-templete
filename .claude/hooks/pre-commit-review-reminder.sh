#!/usr/bin/env bash
# PreToolUse(Bash) guard:
# When the agent runs `git commit`, block unless .review-stamp exists.
# The stamp is created by PostToolUse(Agent) when code-reviewer completes,
# and cleared by PreToolUse(aegis_compile_context) when a new cycle starts.

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
if [ -f "$ROOT/.claude/.review-stamp" ]; then
  exit 0
fi

jq -n '{
  decision: "block",
  reason: "PreToolUse(Bash): code-reviewer agent has not been dispatched. Dispatch the code-reviewer agent on the uncommitted diff before committing."
}'
