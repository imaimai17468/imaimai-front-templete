#!/usr/bin/env bash
# PreToolUse(Agent), code-reviewer only: start a review cycle.
#
# One duty: clear the stamp from any previous cycle, so a stale one cannot leak
# through a review that fails, times out, or is interrupted: the stamp is cleared
# at the next review launch.
#
# This hook samples nothing. An earlier version hashed the working tree here for
# an earlier pairing check, and that was wrong twice over: the window the
# invariant was about began when the finder handed control back rather than when
# it was launched, so hashing here put the finder's whole run inside it and a
# scratch file it left behind voided an innocent pass. Merging the two agents then
# removed the pairing check outright along with the second dispatch, so there is
# no window left to sample either end of.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

# "Agent" is Claude Code's dispatch tool, "Task" is Cursor's (see
# pre-bash-guard.sh for the payload capture).
case "$TOOL" in
  Agent|Task) ;;
  *) exit 0 ;;
esac

# Only a `code-reviewer` dispatch starts a review cycle. Every other Agent
# dispatch — an Explore scout, a parallel implementation unit — must leave an
# already-earned stamp alone.
SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
if [ "$SUBTYPE" != "code-reviewer" ]; then
  exit 0
fi

# Skip in subagent (sidechain) sessions — a review launch from within a
# subagent must not invalidate the parent session's already-earned stamp.
SIDECHAIN_CHECK=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$SIDECHAIN_CHECK" ] && [ -f "$SIDECHAIN_CHECK" ]; then
  if head -1 "$SIDECHAIN_CHECK" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# New cycle: drop the stamp a previous cycle may have left.
rm -f "$ROOT/.claude/.review-stamp"
exit 0
