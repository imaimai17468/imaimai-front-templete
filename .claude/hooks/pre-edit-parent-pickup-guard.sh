#!/usr/bin/env bash
# PreToolUse(Edit|Write|MultiEdit) guard:
# Block Edit/Write/MultiEdit when the parent session attempts to directly pick up
# remaining work immediately after a subagent returned with partial completion.
#
# Per .claude/rules/agents.md, remaining work after partial completion must be
# delegated to a newly dispatched subagent — the parent must not take it over directly.
#
# Block conditions (all must be true):
#   1. Locate the last genuine user prompt in the transcript.
#   2. The window since that prompt contains an Agent tool_use whose tool_result
#      includes a strong partial-completion signal.
#   3. No new Agent tool_use (re-dispatch) appears after the partial-Agent result.
#
# Exceptions (all pass through with exit 0):
#   - Transcript is unreadable / jq parse fails / unexpected structure
#   - No strong partial-completion signal found
#   - Agent was re-dispatched after the partial result

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)

case "$TOOL" in
  Edit|Write|MultiEdit)
    ;;
  *)
    exit 0
    ;;
esac

TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# Extract the window since the last real user message (same logic as pre-agent-aegis-guard.sh).
# WINDOW_LINES=300 is larger than the 200 used in pre-edit-brainstorming-guard.sh because
# a single turn with subagent dispatch + completion + other tool uses can exceed 200 lines.
WINDOW_LINES=300
TOTAL_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ && !/<system-reminder>/ && !/<task-notification>/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

# Fetch the full window
WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT" 2>/dev/null || true)
if [ -z "$WINDOW" ]; then
  exit 0
fi

# Check whether the window contains an Agent tool_use (tool_use entries have no tool_use_id; tool_result does).
# Use grep -c on the final stage so SIGPIPE on the printf doesn't fail the pipeline under pipefail.
AGENT_DISPATCH_COUNT=$(printf '%s' "$WINDOW" | grep -v '"tool_use_id"' | grep -c '"name":"Agent"' || true)
if [ "${AGENT_DISPATCH_COUNT:-0}" -eq 0 ]; then
  exit 0
fi

# Extract only tool_result lines (partial signals are expected inside tool_result)
TOOL_RESULTS=$(printf '%s' "$WINDOW" | grep '"tool_use_id"' || true)
if [ -z "$TOOL_RESULTS" ]; then
  exit 0
fi

# Search tool_result lines for strong partial-completion signals (case-insensitive substring match)
PARTIAL_SIGNALS='partial completion|partially completed|could not complete|stopped working|giving up|残作業|未完了|途中で止|途中までしか|途中までで|finish later|could not finish|unable to complete'

# Use grep -c to avoid SIGPIPE on printf under pipefail.
SIGNAL_COUNT=$(printf '%s' "$TOOL_RESULTS" | grep -ciE "$PARTIAL_SIGNALS" || true)
if [ "${SIGNAL_COUNT:-0}" -eq 0 ]; then
  # No strong signal — pass through
  exit 0
fi

# Identify which line in WINDOW contains the partial-signal tool_result.
# Used as the start of the AFTER_PARTIAL slice.
PARTIAL_LINE_IN_WINDOW=$(printf '%s' "$WINDOW" | awk -v re="$PARTIAL_SIGNALS" '
  BEGIN { IGNORECASE=1 }
  /"tool_use_id"/ && $0 ~ re { print NR; exit }
' || true)
if [ -z "$PARTIAL_LINE_IN_WINDOW" ]; then
  exit 0
fi

# Slice the window to everything after the partial-signal line
AFTER_PARTIAL=$(printf '%s' "$WINDOW" | awk -v pl="$PARTIAL_LINE_IN_WINDOW" 'NR > pl')
if [ -z "$AFTER_PARTIAL" ]; then
  # Partial signal is at the very end of the window — no subsequent lines — potential block.
  :
else
  # If a new Agent tool_use appears after the partial signal, re-dispatch already happened — pass through.
  # Exclude tool_use_id lines (tool_result) so we only look at tool_use entries.
  # Use grep -c to avoid SIGPIPE on printf under pipefail.
  REDISPATCH_COUNT=$(printf '%s' "$AFTER_PARTIAL" | grep -v '"tool_use_id"' | grep -c '"name":"Agent"' || true)
  if [ "${REDISPATCH_COUNT:-0}" -gt 0 ]; then
    exit 0
  fi
fi

# All conditions met — block
REASON='PreToolUse(Edit|Write|MultiEdit): The parent session is attempting to edit directly after a subagent returned with partial completion. Per .claude/rules/agents.md, remaining work must be delegated to a newly dispatched subagent.'

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
