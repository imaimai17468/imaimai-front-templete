#!/usr/bin/env bash
# Stop quality gate: typecheck / lint / format / knip / similarity を順に実行し、
# すべて blocking として扱う。違反があれば decision:block で Claude に修正ループを強制する。

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
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
    systemMessage: "⛔ Stop block: typecheck / lint / format failed",
    decision: "block",
    reason: ("Stop hook: typecheck / lint / format failed. You MUST fix these before ending the turn.\n\n" + .)
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
  [ -n "$KNIP" ] && DETAIL="${DETAIL}=== knip output ===
${KNIP}

"
  [ -n "$SIM" ] && DETAIL="${DETAIL}=== similarity output ===
${SIM}
"

  printf '%s' "$DETAIL" | jq -Rs --arg sum "$SUM" '{
    systemMessage: ("⛔ Stop block: advisory findings — " + $sum),
    decision: "block",
    reason: (
      "Unused code / similar types detected. Resolve via one of:\n" +
      "1. Delete it if unused.\n" +
      "2. If intentional (template use, public API surface, etc.):\n" +
      "   - For knip findings: add `/** @public <reason> */` JSDoc to the export (or add the file to knip.json `ignore` if the entire file is intentionally unused).\n" +
      "   - For similarity findings: add `// similarity-ignore: <reason>` immediately before the type.\n" +
      "3. The `@public` / `similarity-ignore` annotation MUST include the reason it is kept.\n\n" + .
    )
  }'
  exit 0
fi

# すべて clean
echo '{"systemMessage":"✅ Stop quality gate: typecheck / lint / format pass; knip / similarity clean"}'
exit 0
