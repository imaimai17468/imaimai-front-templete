#!/usr/bin/env bash
# PreToolUse(Edit|MultiEdit|Write) entry: read the payload, hand the tool, the
# path and the text the edit produces to guidance_reminder, and print what it
# returns as additionalContext. The three judgments behind that answer live in
# effect-guidance-decision.sh.
#
# The reminder is advisory, so every failure here exits 0 and prints nothing:
# a hook that cannot decide must not stand between the model and its edit.

set -uo pipefail

# additionalContext is fed to Claude without blocking the tool call, which is
# what keeps this hook out of the way of the edit it comments on.
encode_context() { # $1 = the reminder
  jq -n --arg ctx "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: $ctx
    }
  }'
}

INPUT=$(cat)

# `$0` carries the directory whenever the caller names this file by path, which
# .claude/settings.json and the tests both do. The source comes before the tool
# filter so `writes_a_file` is the one tool list in shell; the matcher in
# .claude/settings.json is a second copy that no shell can read.
HOOK_DIR=${0%/*}
# shellcheck source=.claude/hooks/effect-guidance-decision.sh
if ! source "$HOOK_DIR/effect-guidance-decision.sh" 2>/dev/null; then
  exit 0
fi

# Each jq fork costs about 22 ms and this file runs before every Edit and
# Write, so the payload is read in two batches rather than one field at a time.
# `--raw-output0` terminates each field with a NUL, which a `new_string`
# spanning lines survives where a newline-delimited read would cut it in two.
# It arrived in jq 1.7; an older jq fails the call, leaves every field empty,
# and the tool test below takes the silent exit.
{
  IFS= read -r -d '' TOOL
  IFS= read -r -d '' SESSION
  IFS= read -r -d '' AGENT
} < <(printf '%s' "$INPUT" | jq --raw-output0 '
  .tool_name // "",
  .session_id // "",
  .agent_id // ""' 2>/dev/null)

if ! writes_a_file "${TOOL:-}"; then
  exit 0
fi

{
  IFS= read -r -d '' FILE
  IFS= read -r -d '' WRITTEN
} < <(printf '%s' "$INPUT" | jq --raw-output0 '
  .tool_input.file_path // "",
  ([
    .tool_input.content // "",
    .tool_input.new_string // "",
    (.tool_input.edits // [] | map(.new_string // "") | join("\n"))
  ] | join("\n"))' 2>/dev/null)

# The suffix decides before the file is read, because an edit to bun.lock or to
# worker-configuration.d.ts would otherwise pull hundreds of kB into a variable
# for a judgment that throws it away.
if ! holds_typescript_suffix "${FILE:-}"; then
  exit 0
fi

REMINDER=$(guidance_reminder "$TOOL" "$FILE" "${WRITTEN:-}
$(cat "$FILE" 2>/dev/null || true)")
if [ -z "$REMINDER" ]; then
  exit 0
fi

# One reminder per session. A session that edits twenty Effect files would
# otherwise pay for this text twenty times, and the model has either read the
# guidance after the first one or is not going to. A subagent carries its own
# `agent_id`, so it earns its own reminder whether or not the harness hands it
# the parent's session id. Both parts are filtered down to the characters a
# file name takes, so a payload carrying something else names no path outside
# the directory below.
SESSION=$(printf '%s' "${SESSION:-}" | tr -cd 'A-Za-z0-9_-')
AGENT=$(printf '%s' "${AGENT:-}" | tr -cd 'A-Za-z0-9_-')

# A payload with no id at all is one this hook cannot count, so it is reminded
# every time rather than sharing one marker with every other such payload.
if [ -z "$SESSION" ] && [ -z "$AGENT" ]; then
  encode_context "$REMINDER"
  exit 0
fi

# `mkdir` both tests and claims the marker in one step, so of several edits
# Claude Code issued together exactly one prints. A plain `[ -e ]` followed by a
# write let all five of a measured batch through. It also refuses an existing
# path, so a marker name another user predicted and symlinked is not followed.
# Its own failure is the one `2>/dev/null` reaches, where a redirection's
# failure is reported before the redirection applies: an unwritable or missing
# TMPDIR now silences the reminder instead of printing a shell error on every
# edit.
MARKER="${TMPDIR:-/tmp}/claude-effect-guidance-${SESSION}-${AGENT}"
if mkdir "$MARKER" 2>/dev/null; then
  encode_context "$REMINDER"
fi

exit 0
