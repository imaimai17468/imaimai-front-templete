#!/usr/bin/env bash
# Stop combined gate:
# 1. Quality gate — typecheck / lint / format / knip / similarity (blocking)
# 2. Aegis sync check — warn if docs/adr/ changed without sync

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

# Skip when there are no changes
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

# ==== 1. Quality gate ====

# Layer 1: typecheck / lint / format
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

# Layer 2: knip / similarity
KNIP=$(bun run knip 2>&1 || true)
SIM_BIN="$HOME/.cargo/bin/similarity-ts"
SIM=$( ([ -x "$SIM_BIN" ] && "$SIM_BIN" ./src 2>&1) || true)

KNIP_HAS=$(printf '%s' "$KNIP" | grep -cE '^(Unused |Duplicate |Configuration |Unresolved )' || true)

SIM_UNIGNORED=0
if printf '%s' "$SIM" | grep -qE 'Total similar (type pairs|functions) found: [1-9]'; then
  while IFS= read -r loc; do
    file=$(printf '%s' "$loc" | sed 's/\.\///' | cut -d: -f1)
    line=$(printf '%s' "$loc" | cut -d: -f2)
    prev=$((line - 1))
    if [ "$prev" -ge 1 ] && [ -f "$file" ]; then
      prev_content=$(sed -n "${prev}p" "$file")
      case "$prev_content" in *similarity-ignore*) continue ;; esac
    fi
    SIM_UNIGNORED=$((SIM_UNIGNORED + 1))
  done <<< "$(printf '%s' "$SIM" | grep -oE '\./[^ ]+:[0-9]+' | sort -u)"
fi
SIM_HAS=$SIM_UNIGNORED

if [ "$KNIP_HAS" -gt 0 ] || [ "$SIM_HAS" -gt 0 ]; then
  KNIP_SUM=$(printf '%s' "$KNIP" | grep -E '^(Unused |Duplicate |Configuration |Unresolved )' | tr '\n' ' ' || true)
  SIM_SUM=$(printf '%s' "$SIM" | grep -oE 'Total similar type pairs found: [0-9]+|Total similar functions found: [0-9]+' | tr '\n' ' ' || true)
  SUM=""
  [ -n "$KNIP_SUM" ] && SUM="knip: ${KNIP_SUM}"
  [ -n "$SIM_SUM" ] && SUM="${SUM}| similarity: ${SIM_SUM}"

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

# ==== 2. Aegis sync check ====

CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)
ALL_FILES=$(printf '%s\n%s' "$CHANGED" "$UNTRACKED" | sort -u)

RULES_CHANGED=$(printf '%s' "$ALL_FILES" | grep -c '^docs/adr/' || true)

if [ "$RULES_CHANGED" -gt 0 ]; then
  INPUT_DATA=$(cat)
  TRANSCRIPT=$(printf '%s' "$INPUT_DATA" | jq -r '.transcript_path // ""' 2>/dev/null || true)

  AEGIS_CALLED=false
  if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
    if grep -q 'aegis_sync_docs\|aegis_import_doc\|share-materialize' "$TRANSCRIPT" 2>/dev/null; then
      AEGIS_CALLED=true
    fi
  fi

  if [ "$AEGIS_CALLED" = false ]; then
    jq -n '{
      systemMessage: "⚠️ Aegis sync check: docs/adr/ files were modified but no knowledge-base update was detected in this session. Sync the matching aegis-share/source/documents/*.md body, then run `share-format` -> `share-lint` -> `share-materialize` -> `share-export` with `npx -y @fuwasegu/aegis@<pin in .mcp.json>` (preferred), or use aegis_sync_docs / aegis_import_doc."
    }'
    exit 0
  fi
fi

echo '{"systemMessage":"✅ Stop gate: typecheck / lint / format pass (knip/similarity: clean, aegis: synced)"}'
exit 0
