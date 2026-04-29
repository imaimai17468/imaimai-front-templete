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
  REASON="PreToolUse(aegis_compile_context): intent_tags が指定されていません。CLAUDE.md / AGENTS.md の規則により、intent_tags の省略は禁止です。expanded context を明示的にスキップしたい場合は intent_tags: [] を渡してください。intent_tags を使うには先に aegis_get_known_tags でカタログを取得し、関連タグを 1〜3 個選んで渡してください。"
  jq -n --arg reason "$REASON" '{
    decision: "block",
    reason: $reason
  }'
  exit 0
fi

exit 0
