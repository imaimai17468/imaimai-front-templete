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
# "SubagentStop" is Claude Code's spelling; Cursor's third-party hook loader
# runs the same registration and delivers "subagentStop" — captured live in
# this repository on 2026-08-07 from a real code-reviewer completion payload
# (subagent_type "code-reviewer", status "completed"). Both spellings prove
# the same fact; anything else is a mis-registration and stays refused.
case "$EVENT" in
  SubagentStop|subagentStop) ;;
  *)
    jq -n --arg ev "${EVENT:-<absent>}" '{
      systemMessage: ("⚠️ post-agent-review-stamp.sh received hook_event_name=" + $ev + " but only SubagentStop proves the review agent FINISHED (ADR-0022). No stamp was written. Check the SubagentStop registration in .claude/settings.json.")
    }'
    exit 0
    ;;
esac

# Cursor's payload carries a `status` field Claude Code's does not:
# completed | error | aborted. An errored or aborted agent has verified
# nothing, so only "completed" may stamp; a payload without the field (every
# Claude Code payload) skips this check rather than failing it.
#
# No followup_message here, unlike the blank-report refusal below: Cursor
# documents the field as consumed only when status is "completed"
# (https://cursor.com/docs/hooks#subagentstop), so on this branch it would be
# dead weight — and the parent already sees the failed dispatch itself.
STATUS=$(printf '%s' "$INPUT" | jq -r '.status // ""' 2>/dev/null || true)
if [ -n "$STATUS" ] && [ "$STATUS" != "completed" ]; then
  jq -n --arg st "$STATUS" '{
    systemMessage: ("⛔ Review stamp NOT written: the code-reviewer stopped with status=" + $st + ", so it produced no findings report. Re-run the review on the current tree.")
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
# `last_assistant_message` is Claude Code's field. Cursor's hooks doc names
# `summary` for the subagent's report, but the one real subagentStop payload
# captured here (2026-08-07) carried NEITHER field — in that session the stamp
# rode the "absent" branch below, warning included. The summary fallback stays
# for the documented case; Claude's field wins when both somehow appear.
REPORTED=$(printf '%s' "$INPUT" | jq -r '
  def classify(v): if v == null then "blank"
    elif ((v | tostring | gsub("\\s"; "")) == "") then "blank"
    else "present" end;
  if has("last_assistant_message") then classify(.last_assistant_message)
  elif has("summary") then classify(.summary)
  else "absent" end' 2>/dev/null || echo absent)
[ -n "$REPORTED" ] || REPORTED=absent

if [ "$REPORTED" = "blank" ]; then
  MSG="⛔ Review stamp NOT written: the code-reviewer stopped without a final message, so it produced no findings report — a crashed or interrupted review looks exactly like this. Re-run the review on the current tree."
  # In a Cursor session this refusal used to be invisible: systemMessage is
  # Claude Code's channel and Cursor ignores it (see post-bash-stamp-consume.sh),
  # so the first sign was `git commit` being refused later with no stated cause —
  # which on 2026-08-07 ended with an agent asking the user to create the marker
  # by hand. followup_message is the one documented subagentStop output Cursor
  # consumes (https://cursor.com/docs/hooks#subagentstop), so the refusal rides
  # it on the Cursor dialect. Emitted only when loop_count == 0: Claude-registered
  # hooks run in Cursor with NO followup cap (loop_limit defaults to null for
  # third-party hooks per the docs), so an unconditional followup could loop a
  # failing review forever. Scoped to the camelCase event name because what
  # Claude Code does with an unknown followup_message field has not been
  # observed here. scripts/test-review-gate.py pins the emission; whether Cursor
  # actually consumes it from this hook has not been observed yet — no real
  # blank refusal has occurred in a Cursor session since this was added.
  LOOP_COUNT=$(printf '%s' "$INPUT" | jq -r '.loop_count // 0' 2>/dev/null || echo 0)
  if [ "$EVENT" = "subagentStop" ] && [ "$LOOP_COUNT" = "0" ]; then
    jq -n --arg msg "$MSG" '{
      systemMessage: $msg,
      followup_message: ($msg + " Do NOT create the stamp file by hand and do NOT ask the user to — a manual marker forges the commit gate. Re-dispatch the code-reviewer agent (/review-diff) instead.")
    }'
  else
    jq -n --arg msg "$MSG" '{systemMessage: $msg}'
  fi
  exit 0
fi

# The stamp is not a flag, it is the record of which paths this review saw
# (lib-review-scope.sh carries the shape and the containment rule the gate applies
# to it). Written, not touched — an empty stamp would authorise anything.
SCOPE_LIB="$(dirname "$0")/lib-review-scope.sh"
if [ ! -f "$SCOPE_LIB" ]; then
  jq -n '{
    systemMessage: "⚠️ post-agent-review-stamp.sh: .claude/hooks/lib-review-scope.sh is missing, so what this review covered cannot be recorded. No stamp was written and the commit gate stays closed. Restore the file and re-run the review."
  }'
  exit 0
fi
# shellcheck source=lib-review-scope.sh
. "$SCOPE_LIB"

# Refusing to stamp is the fail-closed answer: a stamp recorded without a usable
# scope would contain nothing, refuse every later commit anyway, and do it
# silently with no explanation.
if ! SCOPE=$(cd "$ROOT" && review_scope); then
  jq -n '{
    systemMessage: "⚠️ post-agent-review-stamp.sh: what this review covered could not be recorded, so no stamp was written and the commit gate stays closed. Causes: git could not report the current state, e.g. no commits yet on this branch; or a changed path holds a quote, backslash, or control character, which the stamp format cannot represent."
  }'
  exit 0
fi
printf '%s\n' "$SCOPE" > "$ROOT/.claude/.review-stamp"

if [ "$REPORTED" = "absent" ]; then
  jq -n '{
    systemMessage: "⚠️ Review stamp written, but this SubagentStop payload carried no last_assistant_message, so whether the review agent actually reported could not be checked (ADR-0022). Confirm you received its findings before committing."
  }'
fi

exit 0
