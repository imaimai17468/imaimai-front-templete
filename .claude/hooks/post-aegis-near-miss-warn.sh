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

CONTEXT="[Aegis near_miss_edges warning] The following edge_hints had glob_no_match (the registered glob pattern did not match any file in target_files). If a pattern looks like it SHOULD have matched a target you cared about, this likely indicates a knowledge-graph maintenance issue: report via \`aegis_observe({event_type: \"compile_miss\", ...})\` or fix the edge_hint glob through the admin surface (aegis_import_doc / edge edit). Routine cases where the pattern simply does not relate to your current target_files do not need to be reported.

Near-miss edges:
${NEAR_MISS_LIST}"

jq -n --arg ctx "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
