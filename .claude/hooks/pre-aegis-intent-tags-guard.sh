#!/usr/bin/env bash
# PreToolUse(mcp__aegis__aegis_compile_context) guard:
# aegis_compile_context 呼び出しで intent_tags が未指定の場合を block する。
#
# 目的: CLAUDE.md / AGENTS.md では「intent_tags の省略は禁止。明示的に
#        skip したい場合のみ [] を渡せ」と規定されている。
#        intent_tags フィールドが存在しない / null の呼び出しはすべて block する。
#
# 例外:
#   - intent_tags が空配列 [] の場合は明示的 skip として許容 (block しない)
#   - intent_tags に 1 件以上タグが入っている場合は block しない
#   - tool_name が対象ツール以外の場合は何もしない
#   - jq パースエラー等の想定外状況は exit 0 (素通り)

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

# intent_tags が存在するか確認。
# null / 存在しない = block、[] または配列 = pass
HAS_TAGS=$(printf '%s' "$INPUT" | jq '(.tool_input.intent_tags // null) == null')

if [ "$HAS_TAGS" = "true" ]; then
  REASON="PreToolUse(aegis_compile_context): intent_tags is missing. Per CLAUDE.md / AGENTS.md, omitting intent_tags is forbidden in this repo (the SLM tagger is disabled, so omission yields empty expanded). To explicitly skip expanded context, pass intent_tags: []. To use intent_tags, call aegis_get_known_tags first to load the catalog, then pass 1–3 relevant tags."
  jq -n --arg reason "$REASON" '{
    decision: "block",
    reason: $reason
  }'
  exit 0
fi

exit 0
