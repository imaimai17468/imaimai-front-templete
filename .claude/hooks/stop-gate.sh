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
# downgrades to a warning instead of blocking again when the payload says this
# Stop already triggered a followup, so a pre-existing failure the agent cannot
# fix does not loop forever. The warning names which field said so.
#
# This file reads the payload, enters the tree, runs the steps and encodes the
# JSON. What the gate says, which payload field downgrades a block and whether
# the changed files reach the quality gate all live in stop-gate-decision.sh,
# which this file sources.

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

# Every block that fires before any step runs ends with this, so a step added
# below reaches them without being written into each body again.
NOTHING_RAN="Nothing below it was judged: no typecheck, no lint, no format, no test suite, no markdown link check."

# A `source` that fails leaves every function of the decision file undefined,
# and the gate would then end the turn having judged nothing. Blocking instead
# puts that failure where the turn cannot pass it by. This is the one block the
# downgrade below cannot reach, because the mapping that reads it is in the
# file that would not load; restoring the file is what ends the block.
# `$0` carries the directory whenever the caller names this file by path, which
# .claude/settings.json and stop-gate.test.ts both do; a bare
# `bash stop-gate.sh` leaves the name in place, finds no file under it and
# takes the block.
HOOK_DIR=${0%/*}
# shellcheck source=.claude/hooks/stop-gate-decision.sh
if ! source "$HOOK_DIR/stop-gate-decision.sh" 2>/dev/null; then
  jq -n --arg dir "$HOOK_DIR" --arg nothing "$NOTHING_RAN" '{
    systemMessage: ("⛔ Stop block: the Stop gate could not load " + $dir + "/stop-gate-decision.sh, so no check ran."),
    decision: "block",
    reason: ("The Stop gate could not load " + $dir + "/stop-gate-decision.sh, so no check ran. Put that file back beside stop-gate.sh, or run the hook by a path that names its directory. " + $nothing)
  }'
  exit 0
fi

DOWNGRADE_CAUSE=$(downgrade_cause "$INPUT")

# The message reaches jq through a pipe rather than argv: `--arg body "$2"` made
# execve fail with E2BIG once a step's diagnostics crossed ARG_MAX (1048576 on
# macOS), and the exit below then ended the turn having printed nothing.
# `printf` is a shell builtin, so no message the gate composes passes through an
# argv again.
emit_message() { # the message on stdin
  jq -n --rawfile message /dev/stdin '{systemMessage: $message}'
}

# Emit a block, downgraded to a warning when DOWNGRADE_CAUSE is set, to prevent
# an unfixable failure from looping.
emit_block() { # $1 = summary, $2 = reason body
  if [ -n "$DOWNGRADE_CAUSE" ]; then
    warning_message "$DOWNGRADE_CAUSE" "$1" "$2" | emit_message
  else
    block_reason "$1" "$2" | jq -n --arg message "$(block_message "$1")" --rawfile reason /dev/stdin '{
      systemMessage: $message,
      decision: "block",
      reason: $reason
    }'
  fi
  exit 0
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
  "The directory named by the Stop payload's cwd, or by CLAUDE_PROJECT_DIR, is gone or unreadable. $NOTHING_RAN"

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

The gate cannot tell a clean tree from an unjudged one. $NOTHING_RAN"
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

CODE_RELEVANT=no
if holds_code_relevant_file "$ALL_FILES"; then
  CODE_RELEVANT=yes
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
# Each branch below sets LINK_NOTE, because a note left at "clean" while the
# check failed would contradict the failure section in the same body.
LINK_NOTE=$(link_note_clean)
if command -v bun >/dev/null 2>&1; then
  if ! LINKS=$(bun "$ROOT/.claude/hooks/check-md-links.ts" 2>&1); then
    record_failure "markdown link check" "$LINKS"
    LINK_NOTE=$(link_note_failed)
  fi
else
  LINK_NOTE=$(link_note_skipped)
fi

# ==== Report every failure the steps above collected ====

if [ -n "$GATE_FAILED_STEPS" ]; then
  emit_block "$(failure_summary)" "$(failure_body "$LINK_NOTE")"
fi

if [ "$CODE_RELEVANT" = yes ]; then
  quality_gate_pass_message "$LINK_NOTE" | emit_message
else
  quality_gate_skipped_message "$LINK_NOTE" | emit_message
fi
exit 0
