#!/usr/bin/env bash
# PreToolUse(mcp__aegis__aegis_compile_context) guard:
# Block aegis_compile_context calls that omit intent_tags entirely.
#
# CLAUDE.md / AGENTS.md require intent_tags to always be specified.
# Pass an empty array [] to explicitly skip expanded context.
# Calls where intent_tags is absent or null are blocked.
#
# Exceptions (allowed through):
#   - intent_tags is an empty array [] (explicit skip)
#   - intent_tags contains one or more tags
#   - tool_name is not the target tool
#   - Unexpected situations (e.g. jq parse error) — prefer pass-through

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

# Check whether intent_tags is present.
# null or absent = block; [] or non-empty array = pass
HAS_TAGS=$(printf '%s' "$INPUT" | jq '(.tool_input.intent_tags // null) == null')

if [ "$HAS_TAGS" = "true" ]; then
  REASON="PreToolUse(aegis_compile_context): intent_tags is missing. Per CLAUDE.md / AGENTS.md, omitting intent_tags is not allowed. Pass intent_tags: [] to explicitly skip expanded context, or call aegis_get_known_tags first and provide 1-3 relevant tags."
  jq -n --arg reason "$REASON" '{
    decision: "block",
    reason: $reason
  }'
  exit 0
fi

exit 0
