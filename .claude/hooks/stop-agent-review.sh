#!/usr/bin/env bash
# Stop hook: headless Claude で coding-guide レビューを実施する。
# agent 型 hook が Stop イベントで使えないため、command 型から `claude -p` を呼ぶワークアラウンド。

set -uo pipefail

# 再帰ガード: 内側の `claude -p` から自分が再呼び出しされるのを防ぐ
if [ "${CLAUDE_STOP_HOOK_RECURSION:-}" = "1" ]; then
  exit 0
fi

ROOT="/Users/toshiki.imai/workspace/imaimai-front-templete"
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
あなたはコードレビュワーです。このリポジトリの `.claude/skills/coding-guide/SKILL.md` を Read してから、以下の未コミット変更が規約に従っているかレビューしてください。

**規約の要点**:
- Coding Style: ループ禁止 / Tailwind arbitrary value 禁止 / 色の透明度修飾子禁止
- Architecture: Directory-First Layout / Container-Presenter 分離 / One Component Per File / Props-Driven Design / Pure Function 抽出
- Dependencies: package.json は exact version pinning
- 例外領域: `src/components/ui/*` と `src/lib/utils.ts` (shadcn 由来、page-level ルール適用外)

**出力形式 (厳守)**:
違反が 1 件でもあれば 1 行目に `BLOCK: <違反ファイル・規約名・直し方の要約>` とだけ書く。
違反なしなら 1 行目に `APPROVE` とだけ書く。
それ以外の説明・前置き・マークダウン装飾は一切書かない。
EOP

# headless Claude 起動
RESULT=$(printf '%s\n\n=== git status ===\n%s\n\n=== git diff HEAD ===\n%s\n' "$PROMPT" "$STATUS" "$DIFF" \
  | CLAUDE_STOP_HOOK_RECURSION=1 claude -p --model "$MODEL" --output-format json 2>&1) || {
    echo '{"systemMessage":"⚠️ Stop agent review: claude -p 起動失敗（スキップ）"}'
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
    systemMessage: ("⛔ Stop agent review: coding-guide 違反 — " + $r),
    decision: "block",
    reason: ("Stop agent review で coding-guide 違反を検出しました:\n\n" + $r)
  }'
elif printf '%s' "$FIRST_LINE" | grep -q '^APPROVE'; then
  echo '{"systemMessage":"✅ Stop agent review: coding-guide 準拠"}'
else
  jq -n --arg r "$FIRST_LINE" '{systemMessage: ("⚠️ Stop agent review: 予期しない応答 — " + $r)}'
fi

exit 0
