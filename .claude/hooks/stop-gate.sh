#!/usr/bin/env bash
# Stop combined gate:
# 1. Quality gate — typecheck / lint / format, then the test suite (blocking)
#    — knip and similarity are not here: their verdict is a property of more
#      than this turn's diff, so CI runs knip and lefthook's pre-push runs
#      similarity-ts
#    — runs only when code-relevant files changed (docs-only turns skip it)
# 2. Markdown link check — blocking; dead relative links are decidable by opening
#    the path, so they belong here rather than in a reviewer's judgment
#
# Every step above runs even after an earlier one failed, and one block names
# all of them, so no failure waits for a later Stop to be reported. That block
# respects stop_hook_active: if this Stop was already blocked once, it
# downgrades to a warning instead of blocking again, so a pre-existing failure
# the agent cannot fix does not loop forever.

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
# The body reaches jq through a pipe rather than argv: `--arg body "$2"` made
# execve fail with E2BIG once a step's diagnostics crossed ARG_MAX (1048576 on
# macOS), and the exit below then ended the turn having printed nothing.
# `printf` is a shell builtin, so the body never passes through an argv again.
emit_block() { # $1 = summary, $2 = reason body
  if [ "$STOP_ACTIVE" = "true" ]; then
    printf '%s' "$2" | jq -n --arg sum "$1" --rawfile body /dev/stdin '{
      systemMessage: ("⚠️ Stop gate STILL failing (not re-blocking — stop_hook_active): " + $sum + " — if this failure is pre-existing or unfixable, report it to the user explicitly; do not treat it as passed.\n" + $body)
    }'
  else
    printf '%s' "$2" | jq -n --arg sum "$1" --rawfile body /dev/stdin '{
      systemMessage: ("⛔ Stop block: " + $sum),
      decision: "block",
      reason: ($sum + "\n\n" + $body)
    }'
  fi
  exit 0
}

FAILED_STEPS=""
FAILURE_OUTPUT=""

# A failure is collected instead of emitted, so the steps after it still run and
# one block names all of them.
record_failure() { # $1 = step name, $2 = the step's output
  FAILED_STEPS="${FAILED_STEPS:+$FAILED_STEPS, }$1"
  FAILURE_OUTPUT="${FAILURE_OUTPUT}===== $1 =====
$2

"
}

# `local out` is separate from the assignment because `local out=$(...)` would
# report local's own exit status and lose the one `bun run` returned.
run_step() { # $1 = the `bun run` script to run
  local out
  out=$(bun run "$1" 2>&1) && return 0
  record_failure "bun run $1" "$out"
}

# Every step below reads the tree through the working directory, and `set -e` is
# off, so a failed `cd` would leave them judging whatever tree the session was
# started from. This is the one failure where nothing at all ran, so it takes
# the same block as a failed step rather than a quieter exit. It sits after
# emit_block for that reason.
cd "$ROOT" || emit_block \
  "the Stop gate could not enter $ROOT, so no check ran." \
  "The directory named by the Stop payload's cwd, or by CLAUDE_PROJECT_DIR, is gone or unreadable. Nothing below it was judged: no typecheck, no lint, no format, no test suite, no markdown link check."

# A failed `git status` prints nothing on stdout, and the emptiness test below
# reads that as a clean tree and ends the turn with no check run, so the exit
# status is tested first. stderr joins stdout so the block carries git's own
# diagnostic, which names causes the gate cannot tell apart itself and often
# carries the command that fixes them. A warning on a successful run lands in
# GIT_STATUS too, and costs a checked run over a clean tree, never a skipped one.
GIT_STATUS=$(git status --porcelain 2>&1)
GIT_STATUS_RC=$?
if [ "$GIT_STATUS_RC" -ne 0 ]; then
  emit_block \
    "the Stop gate could not read git status in $ROOT, so no check ran." \
    "\`git status --porcelain\` exited $GIT_STATUS_RC in $ROOT:
$GIT_STATUS

The gate cannot tell a clean tree from an unjudged one. Nothing below it was judged: no typecheck, no lint, no format, no test suite, no markdown link check."
fi

# Skip when there are no changes
if [ -z "$GIT_STATUS" ]; then
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
fi

# ==== 2. Markdown link check ====

# Deliberately scanned repository-wide rather than only over changed files: the
# failure this catches is a link going dead because its TARGET moved or was
# deleted, and the file holding the link is then untouched. Scoping to the diff
# would have missed the case that motivated the check (docs/adr/ deleted on
# 2026-07-29, dead links left in files the same commit did not edit).
# LINK_NOTE carries this step's own verdict into the block body and into both
# summary branches, so a Stop that blocks on another step still says what this
# one did. Each branch below sets it, because a note left at "clean" while the
# check failed would contradict the failure section in the same body.
LINK_NOTE="md links: clean"
if command -v bun >/dev/null 2>&1; then
  if ! LINKS=$(bun "$ROOT/.claude/hooks/check-md-links.ts" 2>&1); then
    record_failure "markdown link check" "$LINKS"
    LINK_NOTE="md links: FAILED"
  fi
else
  # A missing runtime downgrades the step; it never silently passes
  # (AGENTS.md, "Degraded Environments").
  LINK_NOTE="md links: SKIPPED (bun not installed)"
fi

# ==== Report every failure the steps above collected ====

if [ -n "$FAILED_STEPS" ]; then
  emit_block "$FAILED_STEPS failed. Fix before ending the turn." "$FAILURE_OUTPUT$LINK_NOTE"
fi

if [ "$CODE_CHANGED" -gt 0 ]; then
  jq -n --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: typecheck / lint / format and the test suite pass (" + $links + ")")}'
else
  jq -n --arg links "$LINK_NOTE" '{"systemMessage":("✅ Stop gate: no code-relevant changes (quality gate skipped, " + $links + ")")}'
fi
exit 0
