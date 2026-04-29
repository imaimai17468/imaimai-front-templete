#!/usr/bin/env bash
# Stop hook: headless Claude で coding-guide レビューを実施する。
# agent 型 hook が Stop イベントで使えないため、command 型から `claude -p` を呼ぶワークアラウンド。

set -uo pipefail

# 再帰ガード: 内側の `claude -p` から自分が再呼び出しされるのを防ぐ
if [ "${CLAUDE_STOP_HOOK_RECURSION:-}" = "1" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
MODEL="claude-opus-4-7"

cd "$ROOT"

# 変更がなければ即スキップ（会話ターンで発火させない）
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi


STATUS=$(git status --porcelain 2>&1 || true)
DIFF=$(git diff HEAD 2>&1 || true)

# プロンプト（厳密な出力形式で返させる）
read -r -d '' PROMPT <<'EOP' || true
You are a code reviewer. Read this repo's `.claude/rules/*.md` (style / architecture / testing / dependencies / tools), then review whether the following uncommitted changes comply with those rules.

**Rule highlights**:
- Coding Style: no loops; no Tailwind arbitrary values; no color-opacity modifiers.
- Architecture: directory-first layout; Container/Presenter separation; one component per file; props-driven design; extract pure functions.
- Dependencies: package.json must use exact version pinning (no ^ / ~).
- Exempt areas: `src/components/ui/*` and `src/lib/utils.ts` (shadcn-derived; page-level rules do not apply).

**Output format (strict)**:
- If there is at least one violation, write only `BLOCK: <file · rule · how to fix (one-line summary)>` as the first line.
- If there are no violations, write only `APPROVE` as the first line.
- No explanations, preambles, or markdown decoration are allowed.
EOP

# headless Claude 起動
RESULT=$(printf '%s\n\n=== git status ===\n%s\n\n=== git diff HEAD ===\n%s\n' "$PROMPT" "$STATUS" "$DIFF" \
  | CLAUDE_STOP_HOOK_RECURSION=1 claude -p --model "$MODEL" --output-format json 2>&1) || {
    echo '{"systemMessage":"⚠️ Stop agent review: claude -p failed to start (skipped)"}'
    exit 0
  }

# 結果抽出
TEXT=$(printf '%s' "$RESULT" | jq -r '.result // empty' 2>/dev/null)
if [ -z "$TEXT" ]; then
  TEXT="$RESULT"
fi

FIRST_LINE=$(printf '%s' "$TEXT" | head -n 1)

if printf '%s' "$FIRST_LINE" | grep -q '^BLOCK'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^BLOCK:[[:space:]]*//')
  jq -n --arg r "$REASON" '{
    systemMessage: ("⛔ Stop agent review: coding-guide violation — " + $r),
    decision: "block",
    reason: ("Stop agent review detected a coding-guide violation:\n\n" + $r)
  }'
elif printf '%s' "$FIRST_LINE" | grep -q '^APPROVE'; then
  echo '{"systemMessage":"✅ Stop agent review: coding-guide OK"}'
else
  jq -n --arg r "$FIRST_LINE" '{systemMessage: ("⚠️ Stop agent review: unexpected response — " + $r)}'
fi

exit 0
