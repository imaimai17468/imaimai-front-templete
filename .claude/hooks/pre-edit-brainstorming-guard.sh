#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit) guard:
# Block Edit/Write/MultiEdit when the last user prompt contains creative-work
# trigger words (design / idea / brainstorm / etc.) but superpowers:brainstorming
# has not been invoked since that prompt.
#
# CLAUDE.md requires superpowers:brainstorming before any code change triggered
# by creative/design requests. A reminder alone was insufficient — this hook
# enforces compliance by blocking.
#
# Exceptions (allowed through):
#   - No creative trigger words in the user prompt
#   - Bug-fix context (バグ / fix / bug) is clearly present
#   - Edit targets only rule/config files (*.md / *.json / etc.)
#   - Transcript is unreadable
#   - No genuine user prompt found in transcript

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

case "$TOOL" in
  Edit|Write|MultiEdit)
    ;;
  *)
    exit 0
    ;;
esac

# Skip creative guard when the target file is a rules/config-only file
FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""')
case "$FILE_PATH" in
  *.md|*.json|*.toml|*.yaml|*.yml|*.gitignore|*.env*)
    exit 0
    ;;
esac

TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""')
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# Extract the window since the last real user message (same logic as pre-agent-aegis-guard.sh)
WINDOW_LINES=200
TOTAL_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ && !/<system-reminder>/ && !/<task-notification>/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

# Extract the text of the last user prompt
USER_PROMPT=$(awk -v start="$START_LINE" 'NR == start' "$TRANSCRIPT" | jq -r '
  if .content then
    [ .content[] | select(.type == "text") | .text ] | join(" ")
  else
    ""
  end
' 2>/dev/null || true)

if [ -z "$USER_PROMPT" ]; then
  # Unexpected role format — pass through
  exit 0
fi

LOWER_PROMPT=$(printf '%s' "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

# Skip if this is a bug-fix context (reduces false positives)
if printf '%s' "$LOWER_PROMPT" | grep -qE '(バグ|bug|fix |hotfix|bugfix)'; then
  exit 0
fi

# Check for creative trigger words
IS_CREATIVE=0
if printf '%s' "$LOWER_PROMPT" | grep -qE '(brainstorm|design |アイデア|設計|構成案|考えて)'; then
  IS_CREATIVE=1
fi
if printf '%s' "$USER_PROMPT" | grep -qE '(アイデア|設計|構成案|考えて)'; then
  IS_CREATIVE=1
fi

if [ "$IS_CREATIVE" -eq 0 ]; then
  exit 0
fi

# Creative trigger found. Check if superpowers:brainstorming was invoked
# in the window since the last user prompt.
WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT")

# Use grep -c to avoid SIGPIPE on printf under pipefail when WINDOW is large.
BRAIN_COUNT=$(printf '%s' "$WINDOW" | grep -c 'superpowers:brainstorming' || true)
if [ "${BRAIN_COUNT:-0}" -gt 0 ]; then
  exit 0
fi

# brainstorming not invoked → block
REASON="PreToolUse(Edit/Write): Creative work detected but superpowers:brainstorming skill has not been invoked. Call Skill('superpowers:brainstorming') before Edit/Write (see CLAUDE.md / superpowers rules)."

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
