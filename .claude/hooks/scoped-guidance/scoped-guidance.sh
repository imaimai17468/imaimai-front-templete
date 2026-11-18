#!/usr/bin/env bash
# PreToolUse, PostToolUse, UserPromptSubmit and SessionStart entry for
# scoped-guidance.entry.ts. Starting bun costs about 100 ms, and this hook runs
# around every Read, Edit, Write and Bash call and every prompt, so once that
# file has marked this session complete for the rule files on disk now, the
# call is answered here with nothing to print.
#
# On SessionStart from `compact`, which drops what the model read, it deletes
# the markers of the agent that compacted, named as markerPrefix names them, so
# each rule is named again when that agent next reaches it.
#
# The context is advisory, so every failure here exits 0 and prints nothing.

set -uo pipefail

INPUT=$(cat)

{
  IFS= read -r -d '' SESSION
  IFS= read -r -d '' AGENT
  IFS= read -r -d '' EVENT
  IFS= read -r -d '' SOURCE
} < <(printf '%s' "$INPUT" | jq --raw-output0 '
  .session_id // "",
  .agent_id // "",
  .hook_event_name // "",
  .source // ""' 2>/dev/null)

# The same characters scoped-guidance-decision.ts keeps when it names a marker.
SESSION=$(printf '%s' "${SESSION:-}" | tr -cd 'A-Za-z0-9_-')
AGENT=$(printf '%s' "${AGENT:-}" | tr -cd 'A-Za-z0-9_-')

# Handed to bun so the marker directory is decided on this side alone: bun's
# own os.tmpdir() also reads TMP, which this line does not.
TMP_DIR=${TMPDIR:-/tmp}
export SCOPED_GUIDANCE_TMP=${TMP_DIR%/}

if [ "${EVENT:-}" = SessionStart ]; then
  if [ "${SOURCE:-}" = compact ]; then
    PREFIX="$SCOPED_GUIDANCE_TMP/claude-scoped-guidance-${SESSION}-${AGENT}"
    rm -rf "$PREFIX-"* "$PREFIX.complete-"*
  fi
  exit 0
fi

# Counted as completeMarker counts them, so a rule file added mid-session
# names a marker that does not exist yet.
shopt -s nullglob
RULE_FILES=("${CLAUDE_PROJECT_DIR:-$PWD}"/.claude/hooks/guidance/*.md)

COMPLETE="$SCOPED_GUIDANCE_TMP/claude-scoped-guidance-${SESSION}-${AGENT}.complete-${#RULE_FILES[@]}"
if [ -n "$SESSION$AGENT" ] && [ -d "$COMPLETE" ]; then
  exit 0
fi

printf '%s' "$INPUT" | bun "${0%/*}/scoped-guidance.entry.ts"
exit 0
