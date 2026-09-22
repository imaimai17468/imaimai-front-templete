#!/usr/bin/env bash
# Stop entry: read the line this turn's reply opens with, and stop the turn
# where that line is prose instead of the command, the path or the snippet
# .claude/rules/replies.md puts there. The reply arrives in the payload's
# `last_assistant_message`, which carries the turn's final assistant text; the
# transcript file is written asynchronously and can still be short of it.
#
# The refusal leaves on stderr with status 2, which is how a Stop hook keeps
# the turn open and hands the agent its reason. The sibling hooks answer in JSON
# instead, and they carry a `systemMessage` because what they found is the
# user's to read; every word of this refusal is addressed to the agent that has
# to send the reply again, and the user reads the reply itself.
#
# Three things pass without a judgment, and each one is a turn the gate would
# otherwise cost for nothing:
# 1. a Stop already continuing from a stop hook, which bounds every block here
#    at the one turn it costs, the misfires on an explanatory reply included
# 2. a turn whose final assistant text is empty or whitespace alone
# 3. a session where the user typed one of the phrases that stop the shape rule
#
# What each of those judges, and what the agent reads where the line opens with
# prose, are in reply-open-gate-decision.sh, which this file sources.

set -uo pipefail

INPUT=$(cat)

# `$0` carries the directory whenever the caller names this file by path, which
# .claude/settings.json and reply-open-gate.test.ts both do; a bare
# `bash reply-open-gate.sh` leaves the name in place, finds no file under it and
# takes the block below. The block's own wording is here rather than in the file
# that would not load, and it is the one block none of the three passes reaches,
# because the judgment behind each of them is in that file too.
HOOK_DIR=${0%/*}
# shellcheck source=.claude/hooks/reply-open-gate-decision.sh
if ! source "$HOOK_DIR/reply-open-gate-decision.sh" 2>/dev/null; then
  printf '%s\n%s\n' \
    "⛔ Stop block: the reply-open gate could not load $HOOK_DIR/reply-open-gate-decision.sh, so nothing judged this reply's first line." \
    "Put that file back beside reply-open-gate.sh, or run the hook by a path that names its directory." >&2
  exit 2
fi

if [ "$(already_continuing "$INPUT")" = yes ]; then
  exit 0
fi

MESSAGE=$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // ""' 2>/dev/null || true)
if [ -z "$MESSAGE" ]; then
  exit 0
fi

# What the user typed this session, and nothing else: the transcript holds each
# typed message as a `user` entry carrying a human origin, where a tool result
# is a `user` entry too and the text Claude Code injects arrives as an
# `attachment` entry. A message that came with an attachment carries its
# content as blocks rather than as one string.
TYPED_TEXT_FILTER='
  select(.type == "user")
  | select((.origin.kind? // "") == "human" or (.promptSource? // "") == "typed")
  | .message.content
  | if type == "string" then .
    elif type == "array" then (map(select(.type? == "text") | .text? // "") | join("\n"))
    else "" end
'

TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
TYPED=""
if [ -n "$TRANSCRIPT" ] && [ -r "$TRANSCRIPT" ]; then
  TYPED=$(jq -r "$TYPED_TEXT_FILTER" "$TRANSCRIPT" 2>/dev/null || true)
fi

if holds_mode_stop_phrase "$TYPED"; then
  exit 0
fi

LINE=$(first_visible_line "$MESSAGE") || exit 0

if opens_with_runnable_form "$LINE"; then
  exit 0
fi

refusal_message "$LINE" >&2
exit 2
