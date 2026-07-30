#!/usr/bin/env bash
# SubagentStop hook: stamp the commit gate once both review agents have FINISHED.
#
# NOTE ON THE FILENAME. This is a `SubagentStop` hook, not a `PostToolUse` one.
# The `post-agent-` prefix is kept deliberately: ADR-0013, ADR-0015 and ADR-0019
# each name this file, and an ADR records what was decided at the time and is
# never rewritten (AGENTS.md, "ADR form"), so renaming would leave three records
# pointing at a path that does not exist. ADR-0022 records the move.
#
# WHY THE EVENT CHANGED (ADR-0022). `PostToolUse(Agent)` fires when the Agent tool
# call *returns*, and that call returns as soon as the subagent is launched (every
# Agent result in this project's transcripts is `status: "async_launched"` —
# background execution is the platform default). So the previous registration
# stamped at *dispatch* time: two launches in sequence earned a stamp whether or
# not either agent ever produced a verdict. `SubagentStop` is the event that fires
# when a subagent finishes.
#
# WHAT THIS HOOK DOES AND DOES NOT CHECK. A stamp requires two independent facts,
# observable at different moments, so they are gathered by different hooks:
#
#   both agents finished              -> HERE (SubagentStop)
#   the parent did not edit between
#   the two agents (ADR-0015 pairing) -> the finder branch below records the tree
#                                        at the finder's COMPLETION;
#                                        pre-agent-review-pair.sh re-samples at the
#                                        verifier's DISPATCH and writes `.pair-ok`
#
# That window — finder completion to verifier dispatch — contains neither agent's
# own execution, which is the point. Two earlier versions each put one agent's run
# inside it and were voided by the agents' own scratch files: hashing at the
# verifier's completion included the verifier's run, and hashing at the finder's
# dispatch included the finder's.
#
#   code-reviewer finishes   -> touch .finder-done + record .finder-hash. No stamp.
#   review-verifier finishes -> stamp .review-stamp only if BOTH .finder-done and
#                               .pair-ok exist, then consume the cycle's markers.
#                               Otherwise do nothing: fail-closed, commit stays
#                               blocked.

set -euo pipefail

INPUT=$(cat)

# Refuse to act on anything but a SubagentStop payload. This is not defensive
# noise: the failure it guards is a re-registration of this hook under
# `PostToolUse`, where the agent's type arrives under a different key — a script
# reading either would silently return to stamping at launch. Wrong event => no
# stamp (fail-closed) AND a visible warning, because a gate that quietly stops
# gating is worse than one that fails loudly.
EVENT=$(printf '%s' "$INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null || true)
if [ "$EVENT" != "SubagentStop" ]; then
  jq -n --arg ev "${EVENT:-<absent>}" '{
    systemMessage: ("⚠️ post-agent-review-stamp.sh received hook_event_name=" + $ev + " but only SubagentStop proves a review agent FINISHED (ADR-0022). No stamp was written. Check the SubagentStop registration in .claude/settings.json.")
  }'
  exit 0
fi

# WHICH ROLE FINISHED comes from the invocation argument, not the payload.
# `.claude/settings.json` registers this script twice, once per matcher, passing
# `finder` or `verifier` — so the harness's own agent-type matching is the single
# place the mapping lives, and `scripts/test-review-gate.py` asserts that wiring
# against the real settings file. `agent_type` is read only as a fallback for an
# argument-less invocation: 20 of 23 `SubagentStop` payloads captured on
# 2026-07-30 carried `agent_type: ""` (unrelated harness-internal subagents), so
# it is not a field to depend on even though both pinned agents do populate it.
#
# No sidechain check here, unlike the two PreToolUse hooks: this event fires about
# a child that has stopped, so testing the transcript for `isSidechain` would
# either skip every legitimate stamp (if the path is the child's own transcript) or
# test nothing. The case it would guard is moot — the pinned review agents hold no
# `Agent` tool, so a review cannot nest inside a review.
ROLE="${1:-}"
if [ -z "$ROLE" ]; then
  case "$(printf '%s' "$INPUT" | jq -r '.agent_type // ""' 2>/dev/null || true)" in
    code-reviewer) ROLE="finder" ;;
    review-verifier) ROLE="verifier" ;;
  esac
fi
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

case "$ROLE" in
  finder)
    # The finder finished: record that, and record the tree it finished with.
    #
    # This is the pairing baseline (ADR-0022). It is sampled HERE, at the finder's
    # completion, rather than at its dispatch, because the window the invariant is
    # about is the one the PARENT controls — and that window begins when the finder
    # hands control back, not when it was launched. Sampling at the finder's
    # dispatch put the finder's entire run inside the window, so a scratch file the
    # finder created and did not remove before stopping voided an innocent pass.
    # The other end of the window is taken at the verifier's dispatch by
    # pre-agent-review-pair.sh, before the verifier runs, so neither agent's own
    # filesystem use is inside it.
    touch "$ROOT/.claude/.finder-done"
    # shellcheck source=lib-review-hash.sh
    . "$(dirname "$0")/lib-review-hash.sh"
    # Guarded, not bare. A git failure inside `review_diff_hash` would otherwise
    # abort this hook under `set -e` *after* `.finder-done` was already written,
    # leaving a truncated `.finder-hash` that the verifier's dispatch would compare
    # against and silently refuse — no stamp, no reason. Remove the partial file so
    # the pairing check reports "no baseline" rather than "mismatch", and say why.
    if ! review_diff_hash "$ROOT" > "$ROOT/.claude/.finder-hash"; then
      rm -f "$ROOT/.claude/.finder-hash"
      jq -n '{
        systemMessage: "⚠️ post-agent-review-stamp.sh could not compute the working-tree hash the ADR-0015 pairing check needs (git failed enumerating the tree). No baseline was recorded, so this review pass cannot stamp the commit gate. Re-run the finder on a healthy tree."
      }'
    fi
    exit 0
    ;;
  verifier)
    # Both facts required, or no stamp. `.finder-done` proves a finder ran to
    # completion this cycle; `.pair-ok` proves the tree was unchanged across the
    # two dispatches.
    #
    # Not checked: whether the verifier actually reported anything. An earlier
    # version refused to stamp on a blank `last_assistant_message`, which is
    # well-motivated — an agent that stopped without reporting has verified
    # nothing — but it was removed while the field's behaviour was unobserved, and
    # a gate that wedges every commit is worse than the narrow hole it closes. A
    # `review-verifier` payload has since been captured with a 19,525-character
    # message, so the check is now known to be implementable; adding it is left to
    # its own change, with its own validation. Recorded in ADR-0022.
    if [ -f "$ROOT/.claude/.finder-done" ] && [ -f "$ROOT/.claude/.pair-ok" ]; then
      touch "$ROOT/.claude/.review-stamp"
    fi
    # Consume the cycle either way: these markers describe one finder→verifier
    # pass, and leaving them behind would let a later lone verifier stamp.
    rm -f \
      "$ROOT/.claude/.finder-done" \
      "$ROOT/.claude/.pair-ok" \
      "$ROOT/.claude/.finder-hash"
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
