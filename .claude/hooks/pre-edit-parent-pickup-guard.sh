#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit) guard:
# subagent が partial completion で返ってきた直後に parent セッションが
# 直接 Edit/Write/MultiEdit で残作業を巻き取ろうとしたら block する。
#
# 目的: .claude/rules/agents.md "When a subagent returns incomplete" の規定により、
#        partial 完了後の残作業は新しい subagent を再ディスパッチして委譲する義務がある。
#        parent が直接巻き取ることを禁止する。
#
# block 条件 (全てを満たす):
#   1. transcript_path から最後の本物のユーザープロンプト位置を特定
#   2. その位置以降の窓に "name":"Agent" を含む tool_use があり、
#      対応する tool_result が partial completion を示す強い signal を含む
#   3. その partial-Agent 完了以降に、同じ窓内で別の Agent tool_use が
#      新規にディスパッチされた跡がない
#   4. 直近のユーザープロンプト本文に明示的なオーバーライド意図が含まれていない
#
# 例外 (全て exit 0 で素通り):
#   - transcript が読めない / jq でパースできない / 想定外の構造
#   - 強い partial signal が見当たらない
#   - partial-Agent 完了後に Agent 再ディスパッチがある
#   - ユーザーが「parent でやって」等の明示オーバーライドを指示している

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)

case "$TOOL" in
  Edit|Write|MultiEdit)
    ;;
  *)
    exit 0
    ;;
esac

TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# 最後のユーザー入力以降の窓を取り出す (pre-agent-aegis-guard.sh と同じロジック)。
# WINDOW_LINES=300 は pre-edit-brainstorming-guard.sh の 200 より大きめに取っている。
# subagent dispatch + 完了 + 他の tool_use を挟むと 1 ターンで 200 行を超えるケースがあるため、
# fallback 窓を保守的に広めに設定。
WINDOW_LINES=300
TOTAL_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ && !/<system-reminder>/ && !/<task-notification>/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

# 最後のユーザープロンプトのテキストを取得して override チェック
USER_PROMPT_LINE=$(awk -v start="$START_LINE" 'NR == start' "$TRANSCRIPT" 2>/dev/null || true)
USER_PROMPT=$(printf '%s' "$USER_PROMPT_LINE" | jq -r '
  if .content then
    [ .content[] | select(.type == "text") | .text ] | join(" ")
  else
    ""
  end
' 2>/dev/null || true)

# ユーザー明示オーバーライド確認
# 「parent でやって」「自分でやって」「直接書いて」等があれば素通り
if [ -n "$USER_PROMPT" ]; then
  # take it over / do it yourself は文中の自然な表現にも現れるので、word-boundary 寄りの
  # 形 (please / 主語付き) でのみ受ける。bare 部分一致は採用しない。
  if printf '%s' "$USER_PROMPT" | grep -qiE '(parent[[:space:]]*でやって|自分でやって|parent[[:space:]]*でやれ|直接書いて|直接実装して|please[[:space:]]+take[[:space:]]+it[[:space:]]+over|you[[:space:]]+take[[:space:]]+it[[:space:]]+over|do[[:space:]]+it[[:space:]]+yourself)'; then
    exit 0
  fi
fi

# 窓全体を取得
WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT" 2>/dev/null || true)
if [ -z "$WINDOW" ]; then
  exit 0
fi

# 窓内に Agent tool_use があるか確認 (tool_use エントリは tool_use_id を持たない、tool_result が持つ)
if ! printf '%s' "$WINDOW" | grep -v '"tool_use_id"' | grep -q '"name":"Agent"'; then
  exit 0
fi

# tool_result 行のみを抽出 (partial signal は tool_result の中にあるはず)
TOOL_RESULTS=$(printf '%s' "$WINDOW" | grep '"tool_use_id"' || true)
if [ -z "$TOOL_RESULTS" ]; then
  exit 0
fi

# 強い partial completion signal を tool_result 内で検索
# signal は case-insensitive 部分文字列マッチ
PARTIAL_SIGNALS='partial completion|partially completed|could not complete|stopped working|giving up|残作業|未完了|途中で止|途中までしか|途中までで|finish later|could not finish|unable to complete'

if ! printf '%s' "$TOOL_RESULTS" | grep -qiE "$PARTIAL_SIGNALS"; then
  # 強い signal なし → 素通り
  exit 0
fi

# partial signal を含む tool_result 行が、WINDOW 全体の中で何行目かを特定する。
# AFTER_PARTIAL の起点に使う。
PARTIAL_LINE_IN_WINDOW=$(printf '%s' "$WINDOW" | awk -v re="$PARTIAL_SIGNALS" '
  BEGIN { IGNORECASE=1 }
  /"tool_use_id"/ && $0 ~ re { print NR; exit }
' || true)
if [ -z "$PARTIAL_LINE_IN_WINDOW" ]; then
  exit 0
fi

# partial signal 行より後の窓
AFTER_PARTIAL=$(printf '%s' "$WINDOW" | awk -v pl="$PARTIAL_LINE_IN_WINDOW" 'NR > pl')
if [ -z "$AFTER_PARTIAL" ]; then
  # partial signal が窓の最後 → 後続なし → block 対象になりうる
  :
else
  # partial signal 以降に新規 Agent tool_use があれば再ディスパッチ済み → 素通り。
  # tool_use エントリのみを対象にしたいので、tool_use_id を含む行 (= tool_result) は除外する。
  if printf '%s' "$AFTER_PARTIAL" | grep -v '"tool_use_id"' | grep -q '"name":"Agent"'; then
    exit 0
  fi
fi

# 全条件を満たした → block
REASON='PreToolUse(Edit|Write|MultiEdit): subagent が partial completion で返ってきた直後に parent が直接編集しようとしています。.claude/rules/agents.md "When a subagent returns incomplete" の規定により、残作業は新しい subagent をディスパッチして委譲してください。明示的に parent で巻き取りたい場合はユーザーに確認のうえ、ユーザー側から「parent でやって」等の指示を出してもらってください。'

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
