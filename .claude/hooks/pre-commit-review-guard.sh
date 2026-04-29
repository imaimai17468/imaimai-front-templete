#!/usr/bin/env bash
# PreToolUse(Bash) guard:
# git commit 実行前に「直近の subagent dispatch 完了以降に
# superpowers:requesting-code-review skill が起動されていない」場合 block する。
#
# 目的: .claude/rules/agents.md "Before reporting done" の規定を強制する。
#        subagent からの成果物は commit 前に独立した code review を経る必要がある。
#
# 例外 (trivial commit は block しない):
#   - 変更ファイル数 ≤ 1 かつ追加/削除合計 ≤ 5 行
#   - 全ファイルが *.md / .gitignore / *.json で済むケース
#   - コミットメッセージが docs: / chore: プレフィックスかつ trivial 行数
#   - 直近に Agent 完了がない (parent が直接書いた変更のみ) → block しない
#   - transcript が読めない場合 → block しない

set -euo pipefail

# CLAUDE_PROJECT_DIR が未設定の場合は素通り (Claude Code 外での実行など)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$PROJECT_DIR" ]; then
  exit 0
fi

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# git commit を含むかチェック
if ! printf '%s' "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# trivial 判定: コミットメッセージが docs:/chore: プレフィックス
COMMIT_MSG=$(printf '%s' "$COMMAND" | grep -oE '(-m|--message)[[:space:]]+["\047]([^"'\'']+)' | tail -1 || true)
if printf '%s' "$COMMIT_MSG" | grep -qE '(docs:|chore:)'; then
  # docs/chore でも staged の状況を確認して trivial なら pass
  STAGED_STAT=$(git -C "$PROJECT_DIR" diff --staged --stat 2>/dev/null || true)
  if [ -z "$STAGED_STAT" ]; then
    exit 0
  fi
  # ファイル数と変更行数を取得
  CHANGED_FILES=$(printf '%s' "$STAGED_STAT" | grep -c '|' || true)
  INSERTIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' | head -1 || echo 0)
  DELETIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' | head -1 || echo 0)
  TOTAL_LINES=$(( INSERTIONS + DELETIONS ))
  if [ "$CHANGED_FILES" -le 3 ] && [ "$TOTAL_LINES" -le 20 ]; then
    exit 0
  fi
fi

# staged の状態をチェックして trivial かどうか判定
STAGED_STAT=$(git -C "$PROJECT_DIR" diff --staged --stat 2>/dev/null || true)
if [ -z "$STAGED_STAT" ]; then
  # staged が空なら commit 自体が trivial or 別事情
  exit 0
fi

CHANGED_FILES=$(printf '%s' "$STAGED_STAT" | grep -c '|' || true)
INSERTIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' | head -1 || echo 0)
DELETIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' | head -1 || echo 0)
TOTAL_LINES=$(( INSERTIONS + DELETIONS ))

# trivial 判定 1: 1 ファイル以下かつ 5 行以下
if [ "$CHANGED_FILES" -le 1 ] && [ "$TOTAL_LINES" -le 5 ]; then
  exit 0
fi

# trivial 判定 2: 全ファイルが md/json/gitignore 系
ALL_NON_CONFIG=$(git -C "$PROJECT_DIR" diff --staged --name-only 2>/dev/null | grep -vE '\.(md|json|toml|yaml|yml)$|^\.gitignore$' | wc -l | tr -d ' ' || echo 1)
if [ "$ALL_NON_CONFIG" -eq 0 ]; then
  exit 0
fi

# transcript を確認して Agent 完了があるか
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""')
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# 最後のユーザー入力以降の窓
WINDOW_LINES=300
TOTAL_TRANSCRIPT_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_TRANSCRIPT_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ && !/<system-reminder>/ && !/<task-notification>/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT")

# 直近窓内に Agent ツールのディスパッチが存在するか確認。
# 以前は "tool_use_id" の出現数を見ていたが、これだと Bash/Edit/Read など他のツールの
# tool_result まで「Agent 完了」と誤検知してしまう。Agent dispatch は assistant の
# tool_use エントリで "name":"Agent" として現れるので、それを直接数える。
HAS_AGENT_DISPATCH=$(printf '%s' "$WINDOW" | grep -v '"tool_use_id"' | grep -c '"name":"Agent"' || true)
if [ "$HAS_AGENT_DISPATCH" -eq 0 ]; then
  # Agent dispatch なし = parent が直接書いた変更のみ → block しない
  exit 0
fi

# Agent 完了がある場合: requesting-code-review が起動されているか確認
if printf '%s' "$WINDOW" | grep -q 'superpowers:requesting-code-review'; then
  exit 0
fi

REASON="PreToolUse(Bash/git commit): subagent output is about to be committed without an independent code review. Invoke Skill('superpowers:requesting-code-review') before git commit (see .claude/rules/agents.md \"Before reporting done\"). Trivial docs-only / config-only / single-line changes are exempted automatically; if this guard fires, the staged diff likely contains non-trivial changes that should go through review."

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
