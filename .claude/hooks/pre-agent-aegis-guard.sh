#!/usr/bin/env bash
# PreToolUse(Agent) guard:
# subagent dispatch (`Agent` ツール) の直前に aegis_compile_context が
# 呼ばれていなければ block する。
#
# 「直前」の窓は「最後のユーザーメッセージ以降」とする。session 内で
# 1 回呼んだだけで全 dispatch を素通りさせる失敗を防ぐ。
#
# 例外: subagent_type が claude-code-guide / Explore の場合、Aegis 知識を
# 必要としない用途 (CLI Q&A / read-only search) なので block しない。

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
case "$SUBTYPE" in
  claude-code-guide|Explore|statusline-setup|keybindings-help)
    exit 0
    ;;
esac

TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""')
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  # transcript が読めない時は block しない (誤検知より素通りを優先)
  exit 0
fi

# 最後のユーザー入力以降の窓を取り出す。
# Claude Code の transcript は JSONL で、tool_result も role=user で記録されるため、
# 「実ユーザーメッセージ」だけを拾う簡易判定: content 配列に type=text のみ含むもの、
# あるいは parentUuid が null に近い形のもの。ここでは pragmatic に
# `"type":"user-prompt"` か、`"isUserMessage":true` か、最後の 200 行のいずれか
# 大きい方を窓とする。fallback として最後の 200 行は常に確保。

WINDOW_LINES=200
TOTAL_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

# 直近の本当のユーザープロンプトを探す試み:
# - role=user で、content が「単一の text 文字列」または "type":"user-prompt"
LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT")

if printf '%s' "$WINDOW" | grep -q 'aegis_compile_context'; then
  exit 0
fi

REASON="PreToolUse(Agent): 最後のユーザー入力以降に aegis_compile_context の呼び出しが見つかりません。subagent dispatch の前に必ず aegis_compile_context を target_files / plan / command 付きで呼んでください (CLAUDE.md / .claude/rules/agents.md \"Before each dispatch — Aegis is mandatory\" 参照)。read-only search なら subagent_type を Explore にしてください。"

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
