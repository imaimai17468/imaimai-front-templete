#!/usr/bin/env bash
# PreToolUse(Agent) guard:
# Block subagent dispatch (Agent tool) when aegis_compile_context has not been
# called since the last user message.
#
# The "since last user message" window prevents a single early call from
# whitelisting all subsequent dispatches in the session.
#
# Exception: subagent_type claude-code-guide / Explore does not require Aegis
# knowledge (CLI Q&A / read-only search), so those are allowed through.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
case "$SUBTYPE" in
  claude-code-guide|Explore|statusline-setup|keybindings-help)
    exit 0
    ;;
esac

TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""')
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  # Cannot read transcript — prefer false-negative over false-positive.
  exit 0
fi

# Extract the window starting from the last real user message.
# Claude Code transcripts are JSONL where tool_result entries also use role=user,
# so we use a pragmatic heuristic: entries with only type=text content, or
# "type":"user-prompt" / "isUserMessage":true. Fallback: last 200 lines.

WINDOW_LINES=200
TOTAL_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

# Find the last genuine user prompt:
# - role=user entries that do not contain tool_use_id, system-reminder, or task-notification
LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ && !/<system-reminder>/ && !/<task-notification>/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT")

# Use grep -c instead of -q to avoid SIGPIPE-on-printf failure under
# `set -euo pipefail`. With -q grep can exit on first match before printf has
# finished writing the (possibly very large) WINDOW, causing a broken pipe and
# the pipeline to be marked as failed by pipefail — which would incorrectly
# evaluate the if-condition as false and proceed to block.
HIT_COUNT=$(printf '%s' "$WINDOW" | grep -c 'aegis_compile_context' || true)
if [ "${HIT_COUNT:-0}" -gt 0 ]; then
  exit 0
fi

REASON="PreToolUse(Agent): No aegis_compile_context call found since the last user message. Call aegis_compile_context with target_files / plan / command before dispatching a subagent (see CLAUDE.md / .claude/rules/agents.md). For read-only search, use subagent_type Explore instead."

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
