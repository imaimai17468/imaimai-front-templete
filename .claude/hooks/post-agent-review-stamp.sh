#!/usr/bin/env bash
# SubagentStop hook: stamp the commit gate once the review agent has FINISHED
# having reported something.
#
# NOTE ON THE FILENAME. This is a `SubagentStop` hook, not a `PostToolUse` one.
# The `post-agent-` prefix is kept deliberately: ADR-0013, ADR-0015 and ADR-0019
# each name this file, and an ADR records what was decided at the time and is
# never rewritten (the "write-adr" skill), so renaming would leave three records
# pointing at a path that does not exist. ADR-0022 records the move.
#
# WHY THE EVENT IS SubagentStop (ADR-0022). `PostToolUse(Agent)` fires when the
# Agent tool call *returns*, and that call returns as soon as the subagent is
# launched (every Agent result in this project's transcripts is
# `status: "async_launched"` — background execution is the platform default). So
# the previous registration stamped at *dispatch* time: a launch earned a stamp
# whether or not the agent ever produced a verdict. `SubagentStop` is the event
# that fires when a subagent finishes.
#
# WHAT THIS HOOK CHECKS (ADR-0029). One fact, and it is the whole gate:
#
#   the review agent finished having reported something
#
# ADR-0022 required two. The second — that the parent did not edit between the
# finder's completion and the verifier's dispatch — existed only because there
# were two dispatches to have a "between". ADR-0029 merged the finder and the
# verifier into one `code-reviewer` agent running four internal stages, so
# `.finder-done`, `.finder-hash`, `.pair-ok`, `pre-agent-review-pair.sh` and
# `lib-review-hash.sh` are gone with it. What that costs is stated rather than
# papered over: a parent that edits *while* the agent runs now earns a stamp for
# a tree the agent never read. Hashing dispatch → completion cannot close it,
# because the agent holds `Bash` and its own scratch files land inside any such
# window — ADR-0022 tried both ends and each was voided that way.
#
# The blank-report check below is therefore load-bearing in a way it was not when
# it was one of three facts.

set -euo pipefail

# Every decision below parses the payload with jq, and several `jq` calls emit the
# hook's own JSON output, so they cannot be made optional individually. Without the
# binary this script aborted at the first unguarded `jq -n` with `command not found`
# and exit 127 — no stamp, but also no stated reason, which is the shape this file
# exists to eliminate. Checked once, here: the gate stays closed and says so.
if ! command -v jq >/dev/null 2>&1; then
  printf '⚠️ post-agent-review-stamp.sh: jq is not on PATH, so this SubagentStop payload could not be parsed. No review stamp was written and the commit gate stays closed. Install jq (the SessionStart env-check reports it too).\n' >&2
  exit 0
fi

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
    systemMessage: ("⚠️ post-agent-review-stamp.sh received hook_event_name=" + $ev + " but only SubagentStop proves the review agent FINISHED (ADR-0022). No stamp was written. Check the SubagentStop registration in .claude/settings.json.")
  }'
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# THE INVOCATION ARGUMENT IS IGNORED, DELIBERATELY (ADR-0029). Under ADR-0022
# `.claude/settings.json` registered this script twice, passing `finder` or
# `verifier` to select a branch. There is one agent now and one registration,
# which passes nothing. Whether the harness re-reads `.claude/settings.json`
# mid-session is not established here, so a still-cached two-matcher
# registration would keep invoking this script with `finder` — and under a
# script that branched on the argument, `finder` meant "record a baseline, do
# not stamp", which would wedge every commit in that session. Treating all three
# invocations alike removes that failure mode entirely rather than betting on
# harness behaviour nobody has observed. `scripts/test-review-gate.py` pins
# `finder`, `verifier` and no argument.
#
# `agent_type` is not consulted either. The `SubagentStop` matcher in settings.json
# is what selects `code-reviewer`, and 20 of 23 payloads captured on 2026-07-30
# carried `agent_type: ""` — it is not a field to depend on.
#
# No sidechain check, unlike the PreToolUse hooks: this event fires about a child
# that has stopped, so testing the transcript for `isSidechain` would either skip
# every legitimate stamp (if the path is the child's own transcript) or test
# nothing. The case it would guard is moot — the pinned review agent holds no
# `Agent` tool, so a review cannot nest inside a review.

# DID THE AGENT ACTUALLY REPORT? An agent that stopped without a final message has
# reviewed nothing, and that is not hypothetical — a review agent died on an API
# 529 mid-run on 2026-07-30 and the marker files alone stamped an unearned gate.
#
# ADR-0022 deferred this check because the field's behaviour was unobserved and
# "a gate that wedges every commit is worse than the narrow hole it closes". That
# risk is met by splitting the two cases rather than by skipping the check:
#   - present but blank/whitespace -> the agent reported nothing. Refuse to stamp.
#   - absent entirely              -> this harness does not supply the field, so
#                                     there is nothing to judge. Stamp, and SAY the
#                                     check was skipped instead of letting silence
#                                     read as a pass.
# Only the first case can wedge a commit, and it wedges exactly the pass that
# produced no verdict. The populated path is observed, not assumed: a payload
# carrying a 19,525-character message was captured on 2026-07-30.
#
# Classified inside jq rather than against a shell sentinel. A sentinel needs a
# value no real report can equal, and bash cannot hold a NUL byte in a variable —
# the first attempt used one, it collapsed to the empty string, and what was left
# was a prefix a real message could carry. jq distinguishes a missing key from an
# empty one directly. A jq failure classifies as `absent`: warn, do not wedge.
# `has()`, not `// null`: the latter collapses "no such key" and "the key is
# explicitly null" into one bucket, which put a null — the harness stating there
# is no message — on the stamping side, contradicting the rule stated just above.
# A null is present-and-empty, so it counts as blank.
REPORTED=$(printf '%s' "$INPUT" | jq -r '
  if (has("last_assistant_message") | not) then "absent"
  elif (.last_assistant_message == null) then "blank"
  elif ((.last_assistant_message | tostring | gsub("\\s"; "")) == "") then "blank"
  else "present" end' 2>/dev/null || echo absent)
[ -n "$REPORTED" ] || REPORTED=absent

if [ "$REPORTED" = "blank" ]; then
  jq -n '{
    systemMessage: "⛔ Review stamp NOT written: the code-reviewer stopped without a final message, so it produced no findings report — a crashed or interrupted review looks exactly like this. Re-run the review on the current tree."
  }'
  exit 0
fi

touch "$ROOT/.claude/.review-stamp"

if [ "$REPORTED" = "absent" ]; then
  jq -n '{
    systemMessage: "⚠️ Review stamp written, but this SubagentStop payload carried no last_assistant_message, so whether the review agent actually reported could not be checked (ADR-0022). Confirm you received its findings before committing."
  }'
fi

exit 0
