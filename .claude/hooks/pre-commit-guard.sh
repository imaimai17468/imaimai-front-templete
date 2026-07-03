#!/usr/bin/env bash
# PreToolUse(Bash) combined guard for git commit:
# 1. Block if .review-stamp is missing (review gate)
# 2. Regenerate code-graph.json if src/ files are staged

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

# --- Guard 1: review stamp must exist ---
if [ ! -f "$ROOT/.claude/.review-stamp" ]; then
  jq -n '{
    decision: "block",
    reason: "PreToolUse(Bash): the review gate has not been stamped. Run the review-diff workflow (Workflow({name: \"review-diff\"})) — or, if the Workflow tool is unavailable, dispatch the code-reviewer agent — on the uncommitted diff before committing."
  }'
  exit 0
fi

# --- Side effect: regenerate code graph if src/ changed ---
if git -C "$ROOT" diff --cached --name-only | grep -q '^src/'; then
  (cd "$ROOT" && bun run graph 2>/dev/null)
  git -C "$ROOT" add .claude/code-graph.json 2>/dev/null || true
fi

exit 0
