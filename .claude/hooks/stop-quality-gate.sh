#!/usr/bin/env bash
# Stop quality gate: typecheck / lint / format / knip / similarity を順に実行し、
# すべて blocking として扱う。違反があれば decision:block で Claude に修正ループを強制する。

set -uo pipefail

ROOT="/Users/toshiki.imai/workspace/imaimai-front-templete"
cd "$ROOT"

# 変更なしならスキップ
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

# ---- Layer 1: typecheck / lint / format (既存の blocking ゲート) ----
OUT=$(bun run typecheck 2>&1 && bun run lint 2>&1 && bun run format 2>&1)
RC=$?
if [ $RC -ne 0 ]; then
  printf '%s' "$OUT" | jq -Rs '{
    systemMessage: "⛔ Stop block: typecheck/lint/format 失敗",
    decision: "block",
    reason: ("Stop hook: typecheck / lint / format が失敗しました。ターン終了前に必ず修正してください。\n\n" + .)
  }'
  exit 0
fi

# ---- Layer 2: knip / similarity (B-1: blocking 化) ----
KNIP=$(bun run knip 2>&1 || true)
SIM_BIN="$HOME/.cargo/bin/similarity-ts"
SIM=$( ([ -x "$SIM_BIN" ] && "$SIM_BIN" ./src 2>&1) || true)

KNIP_HAS=$(printf '%s' "$KNIP" | grep -cE '^(Unused |Duplicate |Configuration |Unresolved )' || true)
SIM_HAS=$(printf '%s' "$SIM" | grep -cE 'Total similar (type pairs|functions) found: [1-9]' || true)

if [ "$KNIP_HAS" -gt 0 ] || [ "$SIM_HAS" -gt 0 ]; then
  # 要約
  KNIP_SUM=$(printf '%s' "$KNIP" | grep -E '^(Unused |Duplicate |Configuration |Unresolved )' | tr '\n' ' ' || true)
  SIM_SUM=$(printf '%s' "$SIM" | grep -oE 'Total similar type pairs found: [0-9]+|Total similar functions found: [0-9]+' | tr '\n' ' ' || true)
  SUM=""
  [ -n "$KNIP_SUM" ] && SUM="knip: ${KNIP_SUM}"
  [ -n "$SIM_SUM" ] && SUM="${SUM}| similarity: ${SIM_SUM}"

  # 詳細 (reason に入れる)
  DETAIL=""
  [ -n "$KNIP" ] && DETAIL="${DETAIL}=== knip 出力 ===
${KNIP}

"
  [ -n "$SIM" ] && DETAIL="${DETAIL}=== similarity 出力 ===
${SIM}
"

  printf '%s' "$DETAIL" | jq -Rs --arg sum "$SUM" '{
    systemMessage: ("⛔ Stop block: advisory findings — " + $sum),
    decision: "block",
    reason: (
      "未使用コード / 類似型が検出されました。以下のいずれかで対応してください:\n" +
      "1. 不要なら削除する\n" +
      "2. テンプレ用途など意図的に残す場合は:\n" +
      "   - knip findings には `/** @public <理由> */` JSDoc を対象 export に付ける (未使用ファイルの場合は knip.json の `ignore` に追加)\n" +
      "   - similarity findings には該当型の直前に `// similarity-ignore: <理由>` コメントを付ける\n" +
      "3. `@public` / `similarity-ignore` には **なぜ残すかの理由** を必ず含めること\n\n" + .
    )
  }'
  exit 0
fi

# すべて clean
echo '{"systemMessage":"✅ Stop quality gate: typecheck / lint / format pass (knip/similarity: clean)"}'
exit 0
