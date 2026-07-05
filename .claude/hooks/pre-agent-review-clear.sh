#!/usr/bin/env bash
# PreToolUse(Agent): clear .review-stamp when a code-reviewer agent is dispatched.
# The commit gate is then owned by the run that is starting (ADR-0011 fail-closed
# guarantee, preserving ADR-0009's "cleared at the next review launch"): a stale
# stamp from a previous cycle cannot leak through a review that fails, times out,
# or is interrupted before post-agent-review-stamp.sh fires.
#
# This is the mirror of post-agent-review-stamp.sh (which creates the stamp when a
# code-reviewer dispatch COMPLETES). Together they make the gate symmetric:
#   dispatch code-reviewer -> clear  (this hook)
#   code-reviewer completes -> create (post-agent-review-stamp.sh)

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

# Only the review agent owns the gate. The verifier child it dispatches is a
# general-purpose subagent and must not clear the stamp.
SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
if [ "$SUBTYPE" != "code-reviewer" ]; then
  exit 0
fi

# Skip in subagent (sidechain) sessions — a nested review launch must not
# invalidate the parent session's already-earned stamp.
SIDECHAIN_CHECK=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$SIDECHAIN_CHECK" ] && [ -f "$SIDECHAIN_CHECK" ]; then
  if head -1 "$SIDECHAIN_CHECK" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
rm -f "$ROOT/.claude/.review-stamp"
exit 0
