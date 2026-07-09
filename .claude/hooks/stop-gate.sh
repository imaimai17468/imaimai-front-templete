#!/usr/bin/env bash
# Stop combined gate (ADR-0013):
# 1. Quality gate — typecheck / lint / format / knip / similarity (blocking)
#    — runs only when code-relevant files changed (docs-only turns skip it)
#    — respects stop_hook_active: if this Stop was already blocked once, a
#      still-failing gate downgrades to a warning instead of blocking again,
#      so a pre-existing failure the agent cannot fix does not loop forever
# 2. Aegis sync check — warn if docs/adr/ changed without sync

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

INPUT=$(cat)
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo false)

# Emit a block — downgraded to a warning when this Stop was already blocked
# once (stop_hook_active), to prevent an unfixable failure from looping.
emit_block() { # $1 = summary, $2 = reason body (stdin-free)
  if [ "$STOP_ACTIVE" = "true" ]; then
    jq -n --arg sum "$1" --arg body "$2" '{
      systemMessage: ("⚠️ Stop gate STILL failing (not re-blocking — stop_hook_active): " + $sum + " — if this failure is pre-existing or unfixable, report it to the user explicitly; do not treat it as passed.\n" + $body)
    }'
  else
    jq -n --arg sum "$1" --arg body "$2" '{
      systemMessage: ("⛔ Stop block: " + $sum),
      decision: "block",
      reason: ($sum + "\n\n" + $body)
    }'
  fi
  exit 0
}

# Skip when there are no changes
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

# ==== 1. Quality gate (only when code-relevant files changed) ====

CHANGED_ALL=$(git status --porcelain | awk '{print $NF}')
CODE_CHANGED=$(printf '%s\n' "$CHANGED_ALL" | grep -cE '\.(ts|tsx|js|jsx|mjs|cjs|json|css)$' || true)

if [ "$CODE_CHANGED" -gt 0 ]; then
  # Layer 1: typecheck / lint / format
  OUT=$(bun run typecheck 2>&1 && bun run lint 2>&1 && bun run format 2>&1)
  RC=$?
  if [ $RC -ne 0 ]; then
    emit_block "typecheck / lint / format failed. Fix before ending the turn." "$OUT"
  fi

  # Layer 2: knip / similarity
  KNIP=$(bun run knip 2>&1 || true)
  SIM_BIN="$HOME/.cargo/bin/similarity-ts"
  command -v similarity-ts >/dev/null 2>&1 && SIM_BIN=$(command -v similarity-ts)
  SIM_AVAILABLE=true
  if [ -x "$SIM_BIN" ]; then
    SIM=$("$SIM_BIN" ./src 2>&1 || true)
  else
    SIM_AVAILABLE=false
    SIM=""
  fi

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

  if [ "$KNIP_HAS" -gt 0 ] || [ "$SIM_UNIGNORED" -gt 0 ]; then
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

    GUIDANCE="Unused code / similar types detected. Address with one of the following:
1. Delete if unnecessary
2. If kept intentionally (template usage, etc.):
   - For knip findings, attach a \`/** @public <reason> */\` JSDoc to the target export (for unused files, add to \`ignore\` in knip.json)
   - For similarity findings, add a \`// similarity-ignore: <reason>\` comment immediately before the type
3. \`@public\` / \`similarity-ignore\` MUST include **the reason for keeping it**"

    emit_block "advisory findings — ${SUM}" "${GUIDANCE}

${DETAIL}"
  fi
fi

# ==== 2. Aegis sync check ====

CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)
ALL_FILES=$(printf '%s\n%s' "$CHANGED" "$UNTRACKED" | sort -u)

RULES_CHANGED=$(printf '%s' "$ALL_FILES" | grep -c '^docs/adr/' || true)

if [ "$RULES_CHANGED" -gt 0 ]; then
  TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)

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

if [ "$CODE_CHANGED" -gt 0 ]; then
  SIM_NOTE="similarity: clean"
  [ "$SIM_AVAILABLE" = "false" ] && SIM_NOTE="similarity: SKIPPED (similarity-ts not installed)"
  jq -n --arg sim "$SIM_NOTE" '{"systemMessage":("✅ Stop gate: typecheck / lint / format pass (knip: clean, " + $sim + ", aegis: synced)")}'
else
  echo '{"systemMessage":"✅ Stop gate: no code-relevant changes (quality gate skipped, aegis: synced)"}'
fi
exit 0
