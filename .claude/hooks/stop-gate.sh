#!/usr/bin/env bash
# Stop combined gate:
# 1. Quality gate — typecheck / lint / format, then the test suite (blocking)
#    — knip and similarity are not here: their verdict is a property of more
#      than this turn's diff, so CI runs knip and lefthook's pre-push runs
#      similarity-ts
#    — runs only when code-relevant files changed (docs-only turns skip it)
#    — every step runs even after an earlier one failed, and one block names
#      all of them, so no failure waits for a later Stop to be reported
#    — respects stop_hook_active: if this Stop was already blocked once, a
#      failing gate downgrades to a warning instead of blocking again, so a
#      pre-existing failure the agent cannot fix does not loop forever
# 2. Markdown link check — blocking; dead relative links are decidable by opening
#    the path, so they belong here rather than in a reviewer's judgment

set -uo pipefail

INPUT=$(cat)

# CLAUDE_PROJECT_DIR is where the session started, and the input's `cwd` is the
# checkout the session works in; in a worktree session those differ, and the
# gate has to judge the tree the turn edited.
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
if [ -n "$CWD" ] && [ -d "$CWD/.claude/hooks" ]; then
  ROOT="$CWD"
fi
cd "$ROOT"
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

FAILED_STEPS=""
FAILURE_OUTPUT=""

# A failing step is collected instead of emitted, so the caller can run the
# remaining steps and report every failure in one block.
# `local out` is separate from the assignment because `local out=$(...)` would
# report local's own exit status and lose the one `bun run` returned.
run_step() { # $1 = the `bun run` script to run
  local out
  out=$(bun run "$1" 2>&1) && return 0
  FAILED_STEPS="${FAILED_STEPS:+$FAILED_STEPS, }bun run $1"
  FAILURE_OUTPUT="${FAILURE_OUTPUT}===== bun run $1 =====
$out

"
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

CODE_CHANGED=$(printf '%s\n' "$ALL_FILES" | grep -cE '\.(ts|mts|cts|tsx|js|jsx|mjs|cjs|json|css)$' || true)

if [ "$CODE_CHANGED" -gt 0 ]; then
  # `bun run check` is `vp check`, which formats, lints and type-checks over one
  # file walk. `bun run test` is `vp test --run --coverage`.
  run_step check
  run_step test
  if [ -n "$FAILED_STEPS" ]; then
    emit_block "$FAILED_STEPS failed. Fix before ending the turn." "$FAILURE_OUTPUT"
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
  jq -n --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: typecheck / lint / format and the test suite pass (" + $links + ")")}'
else
  jq -n --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: no code-relevant changes (quality gate skipped, " + $links + ")")}'
fi
exit 0
