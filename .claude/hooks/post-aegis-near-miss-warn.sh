#!/usr/bin/env bash
# PostToolUse(mcp__aegis__aegis_compile_context) hook:
# aegis_compile_context の返り値に glob_no_match の near_miss_edges が
# 含まれていたら、additionalContext で強い warning を注入する。
#
# 目的: knowledge graph の edge_hint が意図通りに解決されなかった場合、
#        assistant がそれを見落とすのを防ぐ。
#        block はしない — warning として context に注入するのみ。
#
# 例外:
#   - tool_response に near_miss_edges がない / 空の場合 → exit 0 (無音)
#   - glob_no_match 以外の reason のみの場合 → exit 0
#   - jq パースエラー等の想定外状況 → exit 0 (素通り)

set -euo pipefail

INPUT=$(cat)

# near_miss_edges を取得して glob_no_match のみ抽出
NEAR_MISS_LIST=$(printf '%s' "$INPUT" | jq -r '
  .tool_response.debug_info.near_miss_edges // []
  | map(select(.reason == "glob_no_match"))
  | map("  - doc_id: \(.target_doc_id // "unknown") | pattern: \(.pattern // "unknown")")
  | join("\n")
' 2>/dev/null || true)

if [ -z "$NEAR_MISS_LIST" ]; then
  exit 0
fi

CONTEXT="[Aegis near_miss_edges 警告] 以下の edge_hint は glob_no_match でした（ターゲットファイルに一致するファイルが見つからない）。knowledge graph のメンテナンスが必要です。\`aegis_observe({event_type: \"compile_miss\", ...})\` で報告するか、admin surface (aegis_import_doc / edge 編集) で edge_hint の glob パターンを修正してください。

該当 edge_hint:
${NEAR_MISS_LIST}"

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
