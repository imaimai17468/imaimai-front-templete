#!/usr/bin/env bash
# Stop hook: 新規コンポーネントが実際に画面で動くかを headless Claude + chrome-devtools MCP で検証する。
# Level 1 (smoke) では拾えない「存在している・見えている・振る舞う」を AI の目で確認する。

set -uo pipefail

# 再帰ガード
if [ "${CLAUDE_STOP_HOOK_RECURSION:-}" = "1" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
MODEL="claude-opus-4-7"

cd "$ROOT"

# git clean なら完全無音
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

# 新規 .tsx コンポーネントファイル (untracked or added) を探す
# - shadcn (src/components/ui/), test ファイル, page.tsx / layout.tsx / route.ts は除外
NEW_FILES=$( (git ls-files --others --exclude-standard; git diff --name-only --diff-filter=A HEAD 2>/dev/null) \
  | grep -E '\.(tsx)$' \
  | grep -v -E '(src/components/ui/|\.test\.tsx$|/page\.tsx$|/layout\.tsx$)' \
  | sort -u || true)

if [ -z "$NEW_FILES" ]; then
  echo '{"systemMessage":"✅ Stop component verify: 新規コンポーネントなしのためスキップ"}'
  exit 0
fi

# dev server が起動しているか (Playwright と違い、ここでは自動起動させない)
if ! curl -sf -o /dev/null -m 2 http://localhost:3000; then
  echo '{"systemMessage":"⚠️ Stop component verify: dev server 未起動のためスキップ（`bun run dev` で起動すると次回から検証されます）"}'
  exit 0
fi

# headless Claude 呼び出し用プロンプト
read -r -d '' PROMPT <<EOP || true
あなたは UI 動作検証エージェントです。このターンで新規追加されたコンポーネントが実際に画面で期待通り動くかをブラウザで確認してください。

**新規コンポーネント一覧**:
${NEW_FILES}

**利用可能な MCP ツール**: chrome-devtools (navigate_page, take_snapshot, list_console_messages, evaluate_script など)

**dev server**: http://localhost:3000 で起動中

**手順**:
1. 各新規コンポーネントの内容を Read で確認し、何をするコンポーネントかを把握
2. そのコンポーネントが import されている箇所を Grep で探す（\`src/app/**/page.tsx\` にたどり着くまで）
3. 使われている page の URL を特定（例: \`src/app/profile/page.tsx\` → \`/profile\`）
4. chrome-devtools MCP で該当 URL に navigate_page
5. take_snapshot で DOM 状態を取得し、**コンポーネントの期待される要素・テキストが実在するか** を確認
6. list_console_messages で実行時エラーがないか確認
7. 可能なら evaluate_script で動的な振る舞い（setInterval 等）が動いているかも確認

**どの page にも wire されていないコンポーネント**: 検証不能なので WARN として扱う（block はしない）。

**出力形式 (厳守)**:
- 全コンポーネントが正常: 1 行目に \`APPROVE\`
- どこかで破綻: 1 行目に \`BLOCK: <コンポーネント名 - 具体的な失敗内容と直し方>\`
- 未 wire のみの場合: 1 行目に \`WARN: <コンポーネント名> is not wired to any page\`
JSON や余計な説明は一切書かない。
EOP

RESULT=$(printf '%s' "$PROMPT" \
  | CLAUDE_STOP_HOOK_RECURSION=1 claude -p \
      --model "$MODEL" \
      --output-format json \
      --allowed-tools "Read Grep Glob Bash(curl:*) mcp__chrome-devtools__*" \
      2>&1) || {
  echo '{"systemMessage":"⚠️ Stop component verify: claude -p 起動失敗（スキップ）"}'
  exit 0
}

TEXT=$(printf '%s' "$RESULT" | jq -r '.result // empty' 2>/dev/null)
if [ -z "$TEXT" ]; then
  TEXT="$RESULT"
fi

FIRST_LINE=$(printf '%s' "$TEXT" | head -n 1)

if printf '%s' "$FIRST_LINE" | grep -q '^BLOCK'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^BLOCK:[[:space:]]*//')
  jq -n --arg r "$REASON" '{
    systemMessage: ("⛔ Stop component verify: 動作不良 — " + $r),
    decision: "block",
    reason: ("新規コンポーネントの動作検証で問題を検出しました:\n\n" + $r)
  }'
elif printf '%s' "$FIRST_LINE" | grep -q '^WARN'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^WARN:[[:space:]]*//')
  jq -n --arg r "$REASON" '{systemMessage: ("⚠️ Stop component verify: " + $r)}'
elif printf '%s' "$FIRST_LINE" | grep -q '^APPROVE'; then
  echo '{"systemMessage":"✅ Stop component verify: 新規コンポーネント動作確認済み"}'
else
  jq -n --arg r "$FIRST_LINE" '{systemMessage: ("⚠️ Stop component verify: 予期しない応答 — " + $r)}'
fi

exit 0
