#!/usr/bin/env bash
# Stop combined gate:
# 1. Quality gate — typecheck / lint / format (blocking)
#    — knip and similarity are not here: their verdict is a property of the whole
#      tree rather than of this turn's diff, so CI runs knip and lefthook's
#      pre-push runs similarity-ts
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

if [ "$CODE_CHANGED" -gt 0 ]; then
  # Layer 1: format, lint and type check in one pass. `bun run check` is
  # `vp check`, which runs all three over one file walk.
  OUT=$(bun run check 2>&1)
  RC=$?
  if [ $RC -ne 0 ]; then
    emit_block "bun run check failed. Fix before ending the turn." "$OUT"
  fi
fi

# ==== 2. Markdown link check ====

# Deliberately scanned repository-wide rather than only over changed files: the
# failure this catches is a link going dead because its TARGET moved or was
# deleted, and the file holding the link is then untouched. Scoping to the diff
# would have missed the case that motivated the check (docs/adr/ deleted on
# 2026-07-29, dead links left in files the same commit did not edit).
LINKS_AVAILABLE=true
if command -v bun >/dev/null 2>&1; then
  LINKS=$(bun "$ROOT/.claude/hooks/check-md-links.ts" 2>&1)
  LINKS_RC=$?
  if [ $LINKS_RC -ne 0 ]; then
    emit_block "dead markdown links. Fix the paths before ending the turn." "$LINKS"
  fi
else
  # A missing runtime downgrades the step; it never silently passes
  # (AGENTS.md, "Degraded Environments"). Reported in the summary below.
  LINKS_AVAILABLE=false
fi

# Computed once here and read by both summary branches below. Nothing between
# this point and the summary can exit, so the position is for reuse, not order.
LINK_NOTE="md links: clean"
[ "$LINKS_AVAILABLE" = "false" ] && LINK_NOTE="md links: SKIPPED (bun not installed)"

if [ "$CODE_CHANGED" -gt 0 ]; then
  jq -n --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: typecheck / lint / format pass (" + $links + ")")}'
else
  jq -n --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: no code-relevant changes (quality gate skipped, " + $links + ")")}'
fi
exit 0
