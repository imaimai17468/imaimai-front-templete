#!/usr/bin/env bash
# Stop combined gate:
# 1. Quality gate — typecheck / lint / format / knip / similarity (blocking)
#    — runs only when code-relevant files changed (docs-only turns skip it)
#    — respects stop_hook_active: if this Stop was already blocked once, a
#      still-failing gate downgrades to a warning instead of blocking again,
#      so a pre-existing failure the agent cannot fix does not loop forever
# 2. Markdown link check — blocking; dead relative links are decidable by opening
#    the path, so they belong here rather than in a reviewer's judgment

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$ROOT"

INPUT=$(cat)
# `stop_hook_active` is Claude Code's "this Stop was already blocked once"
# flag. Cursor's stop payload carries `loop_count` (auto-followups already
# triggered) instead — and it runs Claude-registered stop hooks with NO loop
# limit (loop_limit defaults to null for third-party hooks), so without this
# mapping a pre-existing failure would re-block forever there.
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r \
  'if (.stop_hook_active == true) or ((.loop_count // 0) > 0) then "true" else "false" end' \
  2>/dev/null || echo false)

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

# ==== Shared file lists (quality gate + link check) ====
# Full-path, newline-delimited (porcelain + awk would truncate filenames
# containing spaces and silently skip the gate for them). --no-renames lists
# both sides of a rename so neither path escapes the checks.
CHANGED=$(git diff --name-only --no-renames HEAD 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)
ALL_FILES=$(printf '%s\n%s' "$CHANGED" "$UNTRACKED" | sort -u)

# ==== 1. Quality gate (only when code-relevant files changed) ====

CODE_CHANGED=$(printf '%s\n' "$ALL_FILES" | grep -cE '\.(ts|tsx|js|jsx|mjs|cjs|json|css)$' || true)

# Initialised here, not only inside the quality-gate block below, because the
# summary reads it and `set -u` aborts the whole hook on an
# unset name. A docs-only turn skips the quality gate entirely, so similarity is not
# "unavailable" there — it was never attempted, which the summary states separately.
SIM_AVAILABLE=true
# Appended to the summary of any exit that ends the turn while section 1's result is
# in hand. Empty unless similarity was actually attempted and the binary was missing:
# it is assigned in exactly one place, next to `SIM_AVAILABLE=false`, which is only
# reachable with CODE_CHANGED > 0. Guarding each call site on CODE_CHANGED instead
# would work today and drift later — on a docs-only turn SIM_AVAILABLE still holds
# this default, and reporting a default as a measurement is a new false claim, not a
# fix.
SIM_TAG=""

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
  if [ -x "$SIM_BIN" ]; then
    SIM=$("$SIM_BIN" ./src 2>&1 || true)
  else
    SIM_AVAILABLE=false
    SIM_TAG=" (similarity: SKIPPED — similarity-ts not installed)"
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
    # Report only what actually blocks. Every similar-type pair may already
    # carry a `similarity-ignore` comment (SIM_UNIGNORED = 0) while knip alone
    # blocks; echoing the raw similarity total in that case sends the reader
    # chasing findings the gate already accepted.
    KNIP_SUM=$(printf '%s' "$KNIP" | grep -E '^(Unused |Duplicate |Configuration |Unresolved )' | tr '\n' ' ' || true)
    SIM_SUM=""
    [ "$SIM_UNIGNORED" -gt 0 ] && SIM_SUM=$(printf '%s' "$SIM" | grep -oE 'Total similar type pairs found: [0-9]+|Total similar functions found: [0-9]+' | tr '\n' ' ' || true)
    SUM=""
    [ "$KNIP_HAS" -gt 0 ] && [ -n "$KNIP_SUM" ] && SUM="knip: ${KNIP_SUM}"
    if [ -n "$SIM_SUM" ]; then
      [ -n "$SUM" ] && SUM="${SUM}| "
      SUM="${SUM}similarity: ${SIM_SUM}(${SIM_UNIGNORED} un-ignored)"
    fi

    DETAIL=""
    [ "$KNIP_HAS" -gt 0 ] && [ -n "$KNIP" ] && DETAIL="${DETAIL}=== knip output ===
${KNIP}

"
    [ "$SIM_UNIGNORED" -gt 0 ] && [ -n "$SIM" ] && DETAIL="${DETAIL}=== similarity output ===
${SIM}
"

    GUIDANCE="Unused code / similar types detected. Address with one of the following:
1. Delete if unnecessary
2. If kept intentionally (template usage, etc.):
   - For knip findings, attach a \`/** @public <reason> */\` JSDoc to the target export (for unused files, add to \`ignore\` in knip.json)
   - For similarity findings, add a \`// similarity-ignore: <reason>\` comment immediately before the type
3. \`@public\` / \`similarity-ignore\` MUST include **the reason for keeping it**"

    # emit_block's warning form ends the turn without re-blocking, so it is a
    # "reporting completion" exit and has to carry a skipped check like any other.
    # It did not: with similarity-ts absent and a knip finding present, the second
    # Stop reported only knip and let the turn end. SIM_AVAILABLE is a real
    # measurement here because section 1 ran.
    emit_block "advisory findings — ${SUM}${SIM_TAG}" "${GUIDANCE}

${DETAIL}"
  fi
fi

# ==== 2. Markdown link check ====

# Deliberately scanned repository-wide rather than only over changed files: the
# failure this catches is a link going dead because its TARGET moved or was
# deleted, and the file holding the link is then untouched. Scoping to the diff
# would have missed the case that motivated the check (docs/adr/ deleted on
# 2026-07-29, dead links left in files the same commit did not edit).
LINKS_AVAILABLE=true
if command -v python3 >/dev/null 2>&1; then
  LINKS=$(python3 "$ROOT/scripts/check-md-links.py" 2>&1)
  LINKS_RC=$?
  if [ $LINKS_RC -ne 0 ]; then
    # SIM_TAG is empty on a docs-only turn, where section 1 never ran — so this
    # cannot claim similarity was skipped when it was simply never attempted.
    emit_block "dead markdown links. Fix the paths before ending the turn.${SIM_TAG}" "$LINKS"
  fi
else
  # A missing interpreter downgrades the step; it never silently passes
  # (AGENTS.md, "Degraded Environments"). Reported in the summary below.
  LINKS_AVAILABLE=false
fi

# Computed once here and read by both summary branches below. Nothing between
# this point and the summary can exit, so the position is for reuse, not order.
LINK_NOTE="md links: clean"
[ "$LINKS_AVAILABLE" = "false" ] && LINK_NOTE="md links: SKIPPED (python3 not installed)"
SIM_NOTE="similarity: clean"
[ "$SIM_AVAILABLE" = "false" ] && SIM_NOTE="similarity: SKIPPED (similarity-ts not installed)"

if [ "$CODE_CHANGED" -gt 0 ]; then
  jq -n --arg sim "$SIM_NOTE" --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: typecheck / lint / format pass (knip: clean, " + $sim + ", " + $links + ")")}'
else
  jq -n --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: no code-relevant changes (quality gate skipped, " + $links + ")")}'
fi
exit 0
