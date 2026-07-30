#!/usr/bin/env bash
# PreToolUse(Agent), code-reviewer only: start a review cycle.
#
# One duty: clear every marker from any previous cycle, so a stale stamp cannot
# leak through a review that fails, times out, or is interrupted (ADR-0009's
# "cleared at the next review launch", kept by ADR-0011/0015).
#
# This hook deliberately does NOT sample the pairing hash, though an earlier
# version did (ADR-0022). The ADR-0015 invariant is about the window the PARENT
# controls, and that window begins when the finder hands control back — not when it
# is launched. Sampling here put the finder's whole run inside the window, so a
# scratch file the finder left behind voided an innocent pass. The baseline is now
# taken at the finder's completion by post-agent-review-stamp.sh, and compared at
# the verifier's dispatch by pre-agent-review-pair.sh.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

# Only the finder dispatch (cycle start) clears the gate. The review-verifier
# dispatch that follows must NOT clear it — it runs later in the same cycle, and
# `pre-agent-review-pair.sh` handles it.
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

# New cycle: drop every marker a previous cycle may have left.
rm -f \
  "$ROOT/.claude/.review-stamp" \
  "$ROOT/.claude/.finder-done" \
  "$ROOT/.claude/.finder-hash" \
  "$ROOT/.claude/.pair-ok"
exit 0
