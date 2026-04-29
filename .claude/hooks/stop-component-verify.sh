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
  echo '{"systemMessage":"✅ Stop component verify: no new components, skipped"}'
  exit 0
fi

# dev server が起動しているか (Playwright と違い、ここでは自動起動させない)
if ! curl -sf -o /dev/null -m 2 http://localhost:3000; then
  echo '{"systemMessage":"⚠️ Stop component verify: dev server not running, skipped (run `bun run dev` to enable verification)"}'
  exit 0
fi

# headless Claude 呼び出し用プロンプト
read -r -d '' PROMPT <<EOP || true
You are a UI verification agent. Confirm in a real browser that the components newly added in this turn actually render and behave as expected.

**Newly added components**:
${NEW_FILES}

**Available MCP tools**: chrome-devtools (navigate_page, take_snapshot, list_console_messages, evaluate_script, etc.).

**Dev server**: running at http://localhost:3000.

**Steps**:
1. Read each new component to understand what it does.
2. Grep for where it is imported and follow the chain until you reach a \`src/app/**/page.tsx\`.
3. Determine the URL of that page (e.g. \`src/app/profile/page.tsx\` → \`/profile\`).
4. Use chrome-devtools MCP to navigate_page to that URL.
5. take_snapshot to capture the DOM and confirm that the **expected elements / text from the component actually exist on the page**.
6. list_console_messages and confirm there are no runtime errors.
7. If possible, use evaluate_script to verify dynamic behaviour (setInterval, etc.).

**Components not wired into any page**: cannot be verified; treat as WARN (do NOT block).

**Output format (strict)**:
- All components OK: write only \`APPROVE\` as the first line.
- Any failure: write only \`BLOCK: <component name - concrete failure and how to fix>\` as the first line.
- Only unwired components: write only \`WARN: <component name> is not wired to any page\` as the first line.
No JSON, no extra prose.
EOP

RESULT=$(printf '%s' "$PROMPT" \
  | CLAUDE_STOP_HOOK_RECURSION=1 claude -p \
      --model "$MODEL" \
      --output-format json \
      --allowed-tools "Read Grep Glob Bash(curl:*) mcp__chrome-devtools__*" \
      2>&1) || {
  echo '{"systemMessage":"⚠️ Stop component verify: claude -p failed to start (skipped)"}'
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
    systemMessage: ("⛔ Stop component verify: failure — " + $r),
    decision: "block",
    reason: ("Stop component verify detected issues with the newly added component(s):\n\n" + $r)
  }'
elif printf '%s' "$FIRST_LINE" | grep -q '^WARN'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^WARN:[[:space:]]*//')
  jq -n --arg r "$REASON" '{systemMessage: ("⚠️ Stop component verify: " + $r)}'
elif printf '%s' "$FIRST_LINE" | grep -q '^APPROVE'; then
  echo '{"systemMessage":"✅ Stop component verify: new component(s) verified"}'
else
  jq -n --arg r "$FIRST_LINE" '{systemMessage: ("⚠️ Stop component verify: unexpected response — " + $r)}'
fi

exit 0
