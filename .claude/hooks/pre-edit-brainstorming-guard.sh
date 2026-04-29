#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit) guard:
# 「設計／アイデア／構成案」などの creative work を示すユーザープロンプトの
# 直後に、superpowers:brainstorming skill を invoke せずに Edit/Write/MultiEdit
# しようとしたら block する。
#
# 目的: CLAUDE.md ルールにより「コード変更前に必ず superpowers:brainstorming
#        を invoke」が義務付けられているが、reminder だけでは素通りできた。
#        hook で block して遵守を強制する。
#
# 例外:
#   - ユーザープロンプトに creative トリガー語がない場合 → block しない
#   - バグ修正文脈 (バグ / fix / bug) が明確な場合 → block しない
#   - ルール文書 (*.md / *.json 等の config) のみへの編集 → block しない
#   - transcript が読めない場合 → block しない (素通り)
#   - transcript に本物のユーザープロンプトが見当たらない場合 → block しない

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

case "$TOOL" in
  Edit|Write|MultiEdit)
    ;;
  *)
    exit 0
    ;;
esac

# 編集対象ファイルが rules/config 専用なら creative guard を適用しない
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""')
case "$FILE_PATH" in
  *.md|*.json|*.toml|*.yaml|*.yml|*.gitignore|*.env*)
    exit 0
    ;;
esac

TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""')
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# 最後のユーザー入力以降の窓を取り出す (pre-agent-aegis-guard.sh と同じロジック)
WINDOW_LINES=200
TOTAL_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ && !/<system-reminder>/ && !/<task-notification>/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

# 最後のユーザープロンプトのテキストを取得
USER_PROMPT=$(awk -v start="$START_LINE" 'NR == start' "$TRANSCRIPT" | jq -r '
  if .content then
    [ .content[] | select(.type == "text") | .text ] | join(" ")
  else
    ""
  end
' 2>/dev/null || true)

if [ -z "$USER_PROMPT" ]; then
  # role フォーマットが想定外。素通り
  exit 0
fi

LOWER_PROMPT=$(printf '%s' "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

# bug fix 文脈なら skip (false positive 抑制)
if printf '%s' "$LOWER_PROMPT" | grep -qE '(バグ|bug|fix |hotfix|bugfix)'; then
  exit 0
fi

# creative トリガー語チェック
IS_CREATIVE=0
if printf '%s' "$LOWER_PROMPT" | grep -qE '(brainstorm|design |アイデア|設計|構成案|考えて)'; then
  IS_CREATIVE=1
fi
if printf '%s' "$USER_PROMPT" | grep -qE '(アイデア|設計|構成案|考えて)'; then
  IS_CREATIVE=1
fi

if [ "$IS_CREATIVE" -eq 0 ]; then
  exit 0
fi

# creative トリガーが見つかった。ユーザープロンプト以降の窓で
# superpowers:brainstorming skill invocation があるか確認する
WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT")

if printf '%s' "$WINDOW" | grep -q 'superpowers:brainstorming'; then
  exit 0
fi

# brainstorming が起動されていない → block
REASON="PreToolUse(Edit/Write): creative work を検知しているのに superpowers:brainstorming skill が起動されていません。Edit/Write の前に Skill('superpowers:brainstorming') を invoke してください (CLAUDE.md / superpowers ルール参照)。"

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
