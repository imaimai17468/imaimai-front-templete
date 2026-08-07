#!/usr/bin/env bash
# PreToolUse(aegis_compile_context) combined guard:
# 1. Block calls that omit intent_tags (must be [] or a tag array)
# 2. Clear .review-stamp to start a new implementation cycle (the only gate
#    marker left since ADR-0029)

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

case "$TOOL" in
  # Claude Code names MCP tools mcp__<server>__<tool>; Cursor names them
  # MCP:<tool> with no server segment (payload captured 2026-08-07, so the
  # Cursor form cannot distinguish the agent surface from the admin one —
  # both were accepted here anyway).
  mcp__aegis__aegis_compile_context|mcp__aegis-admin__aegis_compile_context|MCP:aegis_compile_context)
    ;;
  *)
    exit 0
    ;;
esac

# --- Guard: intent_tags must be present ---
HAS_TAGS=$(printf '%s' "$INPUT" | jq '(.tool_input.intent_tags // null) == null')

if [ "$HAS_TAGS" = "true" ]; then
  REASON="PreToolUse(aegis_compile_context): intent_tags is missing. Per CLAUDE.md / AGENTS.md, omitting intent_tags is not allowed. Pass intent_tags: [] to explicitly skip expanded context, or call aegis_get_known_tags first and provide 1-3 relevant tags."
  # Both dialects at once — see pre-bash-guard.sh.
  jq -n --arg reason "$REASON" '{
    decision: "block",
    reason: $reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

# --- Side effect: clear the review stamp for a new cycle ---
# One marker, not four. ADR-0029 deleted the other three along with the second
# review dispatch they paired, so listing them here would name files nothing
# creates. `pre-bash-guard.sh`'s Guard 3 carries the names and the history.
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
rm -f "$ROOT/.claude/.review-stamp"

exit 0
