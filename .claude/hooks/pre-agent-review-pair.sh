#!/usr/bin/env bash
# PreToolUse(Agent), review-verifier only: close the ADR-0015 pairing check.
#
# `post-agent-review-stamp.sh` recorded the working-tree hash in `.finder-hash`
# when the finder FINISHED. This takes the second sample now, at the verifier's
# dispatch — before the verifier runs — and writes `.pair-ok` only if they are
# equal, i.e. only if the parent changed nothing in between.
# `post-agent-review-stamp.sh` then requires `.pair-ok` before it will stamp.
#
# The window is therefore [finder completion, verifier dispatch], which contains
# neither agent's own execution. That is the whole point, and it took three
# attempts (ADR-0022): hashing at the verifier's completion put the verifier's run
# inside the window, hashing at the finder's dispatch put the finder's run inside
# it, and in both cases a scratch file an agent created during its own work voided
# a pass in which the parent had changed nothing.
#
# The two facts a stamp needs are observable at different moments, which is why
# they are gathered by different hooks:
#
#   the parent did not edit between the agents -> here, comparing the two samples
#   both agents actually finished              -> SubagentStop, in the stamp hook
#
# Fail-closed: no recorded hash, an unreadable one, or a mismatch all leave
# `.pair-ok` absent, so the gate stays shut. This hook never blocks the dispatch —
# a verifier is still allowed to run and report; it just cannot certify a commit.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
if [ "$SUBTYPE" != "review-verifier" ]; then
  exit 0
fi

# Skip in subagent (sidechain) sessions, for the same reason as the clear hook:
# the markers are the parent session's state.
SIDECHAIN_CHECK=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$SIDECHAIN_CHECK" ] && [ -f "$SIDECHAIN_CHECK" ]; then
  if head -1 "$SIDECHAIN_CHECK" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
# shellcheck source=lib-review-hash.sh
. "$(dirname "$0")/lib-review-hash.sh"

# A verifier dispatched without a finder having COMPLETED this cycle cannot pair —
# `.finder-hash` only exists once the finder's SubagentStop has fired.
rm -f "$ROOT/.claude/.pair-ok"
if [ ! -f "$ROOT/.claude/.finder-hash" ]; then
  exit 0
fi

RECORDED=$(cat "$ROOT/.claude/.finder-hash" 2>/dev/null || true)

# Guarded, not bare. `review_diff_hash` propagates a git failure (its `ls-files`
# stage is intentionally NOT `|| true` — see lib-review-hash.sh), so a bare
# assignment under `set -e` would abort this hook instantly and print nothing at
# all, which is the one outcome worse than refusing to pair: no stamp AND no
# stated reason. Report it the way a mismatch is reported, then leave `.pair-ok`
# absent so the gate stays closed.
if ! CURRENT=$(review_diff_hash "$ROOT"); then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: "[review gate] Could not compute the working-tree hash the ADR-0015 pairing check needs (git failed enumerating the tree). This pass cannot stamp the commit gate. The verifier will still run and report; re-dispatch code-reviewer on a healthy tree to earn a stamp."
    }
  }'
  exit 0
fi

if [ -n "$RECORDED" ] && [ "$RECORDED" = "$CURRENT" ]; then
  touch "$ROOT/.claude/.pair-ok"
else
  # Say so rather than failing silently: the parent edited between the two
  # dispatches, which costs the whole pass, and the only way to notice used to be
  # a commit refused several minutes later for no stated reason.
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: "[review gate] The working tree changed between the code-reviewer FINISHING and this review-verifier dispatch, so this pass cannot stamp the commit gate (ADR-0015 pairing). The verifier will still run and report. To earn a stamp, dispatch code-reviewer again on the current tree and change nothing until the verifier has been dispatched — note that a file a review agent leaves behind counts as a change too."
    }
  }'
fi
exit 0
