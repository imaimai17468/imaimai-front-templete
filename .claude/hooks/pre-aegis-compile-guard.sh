#!/usr/bin/env bash
# PreToolUse(aegis_compile_context) combined guard:
# 1. Block calls that omit intent_tags (must be [] or a tag array)
# 2. Clear .review-stamp to start a new implementation cycle

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

case "$TOOL" in
  mcp__aegis__aegis_compile_context|mcp__aegis-admin__aegis_compile_context)
    ;;
  *)
    exit 0
    ;;
esac

# --- Guard: intent_tags must be present ---
HAS_TAGS=$(printf '%s' "$INPUT" | jq '(.tool_input.intent_tags // null) == null')

if [ "$HAS_TAGS" = "true" ]; then
  REASON="PreToolUse(aegis_compile_context): intent_tags is missing. Per CLAUDE.md / AGENTS.md, omitting intent_tags is not allowed. Pass intent_tags: [] to explicitly skip expanded context, or call aegis_get_known_tags first and provide 1-3 relevant tags."
  jq -n --arg reason "$REASON" '{
    decision: "block",
    reason: $reason
  }'
  exit 0
fi

# --- Side effect: clear review stamp for new cycle ---
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
rm -f "$ROOT/.claude/.review-stamp"

exit 0
