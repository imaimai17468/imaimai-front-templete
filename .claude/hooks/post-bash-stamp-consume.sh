#!/usr/bin/env bash
# PostToolUse(Bash) hook (ADR-0019): consume .claude/.review-stamp once the
# reviewed work is fully committed.
#
# The stamp has to outlive a commit — one review covers a multi-commit split
# (ADR-0013 kept that property deliberately, and committing does not edit
# files). But it must not outlive the *task*, or a later, never-reviewed change
# inherits it. A clean working tree after a commit is the observable end of the
# reviewed batch: nothing is left of what the review saw, so the stamp has
# nothing left to authorise.
#
# This is one of two mechanisms; the other is the scope check in
# pre-bash-guard.sh. Neither is sufficient alone — see ADR-0019 for the residual
# gap they leave (a task boundary crossed with leftover dirt in the tree, where
# the follow-on work touches only already-reviewed files).
#
# Do NOT put the word "commit" back in this file's name. The commit gate matches
# `git <anything> commit` across a whitespace-normalised command, so a filename
# containing it makes `git add <this file>` look like a commit and blocks it.
# The first draft was called post-bash-commit-clear.sh and could not be staged.

set -uo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

[ "$TOOL" = "Bash" ] || exit 0

# Skip in subagent (sidechain) sessions — the stamp is the parent session's
# state, and a dispatched worker's Bash use must not consume it. Same guard as
# every other hook in this lifecycle (pre-bash-guard.sh,
# post-agent-review-stamp.sh, pre-agent-review-clear.sh).
SIDECHAIN_CHECK=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$SIDECHAIN_CHECK" ] && [ -f "$SIDECHAIN_CHECK" ]; then
  if head -1 "$SIDECHAIN_CHECK" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# Like the commit gate in pre-bash-guard.sh, but requiring `commit` to be a
# whitespace-delimited token rather than any `\bcommit\b` substring. The gate can
# afford the loose form because over-matching there only runs a check that then
# passes; here over-matching *deletes* the stamp, so `git checkout -b
# feature/commit-fix` or `git log --grep=commit` must not count as a commit.
# Keep the two patterns in step: a change to one is a prompt to re-read the other.
NORM=$(printf '%s' "$CMD" | tr -s '[:space:]' ' ')
printf '%s' "$NORM" | grep -qE '(^|[;&| ])git ([^;&|]*[[:space:]])?commit([[:space:]]|$)' || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
[ -f "$ROOT/.claude/.review-stamp" ] || exit 0

# --exclude-standard/--porcelain both ignore the gitignored gate markers, so a
# tree holding only .claude/ state counts as clean.
if [ -z "$(git -C "$ROOT" status --porcelain 2>/dev/null || echo dirty)" ]; then
  rm -f "$ROOT/.claude/.review-stamp"
  jq -n '{systemMessage: "Review stamp consumed: the reviewed changes are fully committed (ADR-0019). The next task needs its own review."}'
fi

exit 0
