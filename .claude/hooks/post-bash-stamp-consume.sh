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

# "Bash" is Claude Code's terminal tool, "Shell" is Cursor's (see
# pre-bash-guard.sh for the payload capture).
case "$TOOL" in
  Bash|Shell) ;;
  *) exit 0 ;;
esac

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

# Same question as the commit gate in pre-bash-guard.sh, so the same answer:
# lib-commit-shape.sh. These two used to carry separate hand-written regexes with a
# comment asking the next editor to keep them in step, and they drifted — this side
# required whitespace after `commit` while the gate accepted any `\bcommit\b`, so
# `git commit;true` was gated on the way in and NOT recognised as a landed commit on
# the way out. A live stamp then authorised the next, unreviewed change: exactly the
# hole this hook exists to close (ADR-0019). Verified 2026-07-30.
#
# Precision still matters more here than there: over-matching *deletes* a stamp the
# review legitimately earned, so `git log --grep=commit` and
# `git checkout -b feature/commit-fix` must not count. The shared helper keeps
# `commit` a whitespace-delimited word for that reason.
# shellcheck source=lib-commit-shape.sh
. "$(dirname "$0")/lib-commit-shape.sh"
# Everything from the first heredoc operator onward is data, not a command, and is
# cut before asking. `echo 'please run git commit later'`-style prose was enough to
# consume a stamp the review had legitimately earned; writing a document through a
# heredoc whose body says `git … commit` is a routine technique here, so the
# exposure was real rather than theoretical. This mirrors what Guard 2 in
# pre-bash-guard.sh already does for `find`.
#
# It does not hide a real commit: in `git commit -F - <<'MSG' … MSG` the verb sits
# before the operator, so the truncated string still contains it. The gate side is
# deliberately NOT truncated — over-blocking there costs a check that passes, and
# leaving the heredoc in place keeps that side the stricter of the two.
command_lands_a_commit "${CMD%%<<*}" || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
[ -f "$ROOT/.claude/.review-stamp" ] || exit 0

# --exclude-standard/--porcelain both ignore the gitignored gate markers, so a
# tree holding only .claude/ state counts as clean.
if [ -z "$(git -C "$ROOT" status --porcelain 2>/dev/null || echo dirty)" ]; then
  rm -f "$ROOT/.claude/.review-stamp"
  # systemMessage is Claude Code's user-visible channel; Cursor ignores it, so
  # the same text also rides hookSpecificOutput.additionalContext, which both
  # harnesses inject into the conversation.
  jq -n '{
    systemMessage: "Review stamp consumed: the reviewed changes are fully committed (ADR-0019). The next task needs its own review.",
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "Review stamp consumed: the reviewed changes are fully committed (ADR-0019). The next task needs its own review."
    }
  }'
fi

exit 0
