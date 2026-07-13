#!/usr/bin/env bash
# PreToolUse(Agent): clear .review-stamp when a code-reviewer agent is dispatched.
# The commit gate is then owned by the run that is starting (ADR-0011 fail-closed
# guarantee, preserving ADR-0009's "cleared at the next review launch"): a stale
# stamp from a previous cycle cannot leak through a review that fails, times out,
# or is interrupted before post-agent-review-stamp.sh fires.
#
# This is the mirror of post-agent-review-stamp.sh (ADR-0015). The flat review
# pipeline is: parent dispatches code-reviewer (find) then review-verifier
# (verify). code-reviewer is the FIRST step, so its dispatch marks the start of
# a new review cycle and clears any stale stamp; the verifier's COMPLETION (last
# step) creates it. Together they keep the gate symmetric:
#   dispatch code-reviewer (find, cycle start) -> clear  (this hook)
#   review-verifier completes (verify, cycle end) -> create (post-agent-review-stamp.sh)

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

# Only the finder dispatch (cycle start) clears the gate. The review-verifier
# dispatch that follows must NOT clear it — it runs later in the same cycle and
# its completion is what creates the stamp.
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
# New review cycle: drop both the stamp and any finder marker from a prior cycle
# (the finder about to run writes a fresh .finder-done on completion, ADR-0015).
rm -f "$ROOT/.claude/.review-stamp" "$ROOT/.claude/.finder-done"
exit 0
