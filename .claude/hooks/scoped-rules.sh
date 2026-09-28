#!/usr/bin/env bash
# PreToolUse and PostToolUse entry for scoped-rules.entry.ts. Starting bun
# costs about 100 ms, and this hook runs around every Read, Edit, Write and
# Bash call, so once that file has marked this session complete for the rule
# files on disk now, the call is answered here with nothing to print.
#
# The context is advisory, so every failure here exits 0 and prints nothing.

set -uo pipefail

INPUT=$(cat)

{
  IFS= read -r -d '' SESSION
  IFS= read -r -d '' AGENT
} < <(printf '%s' "$INPUT" | jq --raw-output0 '
  .session_id // "",
  .agent_id // ""' 2>/dev/null)

# The same characters scoped-rules-decision.ts keeps when it names a marker.
SESSION=$(printf '%s' "${SESSION:-}" | tr -cd 'A-Za-z0-9_-')
AGENT=$(printf '%s' "${AGENT:-}" | tr -cd 'A-Za-z0-9_-')

# Handed to bun so the marker directory is decided on this side alone: bun's
# own os.tmpdir() also reads TMP, which this line does not.
TMP_DIR=${TMPDIR:-/tmp}
export SCOPED_RULES_TMP=${TMP_DIR%/}

# Counted as completeMarker counts them, so a rule file added mid-session
# names a marker that does not exist yet.
shopt -s nullglob
RULE_FILES=("${CLAUDE_PROJECT_DIR:-$PWD}"/.claude/rules/*.md)

COMPLETE="$SCOPED_RULES_TMP/claude-scoped-rules-${SESSION}-${AGENT}.complete-${#RULE_FILES[@]}"
if [ -n "$SESSION$AGENT" ] && [ -d "$COMPLETE" ]; then
  exit 0
fi

printf '%s' "$INPUT" | bun "${0%/*}/scoped-rules.entry.ts"
exit 0
