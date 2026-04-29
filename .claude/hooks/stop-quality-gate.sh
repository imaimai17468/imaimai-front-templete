#!/usr/bin/env bash
# Stop quality gate: run typecheck / lint / format / knip / similarity in order,
# all treated as blocking. Any violation triggers decision:block to force a fix loop on Claude.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

# Skip when there are no changes
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

# ---- Layer 1: typecheck / lint / format (existing blocking gate) ----
OUT=$(bun run typecheck 2>&1 && bun run lint 2>&1 && bun run format 2>&1)
RC=$?
if [ $RC -ne 0 ]; then
  printf '%s' "$OUT" | jq -Rs '{
    systemMessage: "⛔ Stop block: typecheck / lint / format failed",
    decision: "block",
    reason: ("Stop hook: typecheck / lint / format failed. Fix before ending the turn.\n\n" + .)
  }'
  exit 0
fi

# ---- Layer 2: knip / similarity (B-1: now blocking) ----
KNIP=$(bun run knip 2>&1 || true)
SIM_BIN="$HOME/.cargo/bin/similarity-ts"
SIM=$( ([ -x "$SIM_BIN" ] && "$SIM_BIN" ./src 2>&1) || true)

KNIP_HAS=$(printf '%s' "$KNIP" | grep -cE '^(Unused |Duplicate |Configuration |Unresolved )' || true)
SIM_HAS=$(printf '%s' "$SIM" | grep -cE 'Total similar (type pairs|functions) found: [1-9]' || true)

if [ "$KNIP_HAS" -gt 0 ] || [ "$SIM_HAS" -gt 0 ]; then
  # Summary
  KNIP_SUM=$(printf '%s' "$KNIP" | grep -E '^(Unused |Duplicate |Configuration |Unresolved )' | tr '\n' ' ' || true)
  SIM_SUM=$(printf '%s' "$SIM" | grep -oE 'Total similar type pairs found: [0-9]+|Total similar functions found: [0-9]+' | tr '\n' ' ' || true)
  SUM=""
  [ -n "$KNIP_SUM" ] && SUM="knip: ${KNIP_SUM}"
  [ -n "$SIM_SUM" ] && SUM="${SUM}| similarity: ${SIM_SUM}"

  # Detail (placed in reason)
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
      "Unused code / similar types detected. Address with one of the following:\n" +
      "1. Delete if unnecessary\n" +
      "2. If kept intentionally (template usage, etc.):\n" +
      "   - For knip findings, attach a `/** @public <reason> */` JSDoc to the target export (for unused files, add to `ignore` in knip.json)\n" +
      "   - For similarity findings, add a `// similarity-ignore: <reason>` comment immediately before the type\n" +
      "3. `@public` / `similarity-ignore` MUST include **the reason for keeping it**\n\n" + .
    )
  }'
  exit 0
fi

# All clean
echo '{"systemMessage":"✅ Stop quality gate: typecheck / lint / format pass (knip/similarity: clean)"}'
exit 0
