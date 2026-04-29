#!/usr/bin/env bash
# PreToolUse(Bash) guard:
# Block git commit when superpowers:requesting-code-review has not been invoked
# since the most recent subagent dispatch completed.
#
# Enforces .claude/rules/agents.md "Before reporting done": subagent output must
# go through an independent code review before being committed.
#
# Exceptions (trivial commits are not blocked):
#   - Changed files ≤ 1 and total added/deleted lines ≤ 5
#   - All changed files are *.md / .gitignore / *.json
#   - Commit message has docs: / chore: prefix and trivial line count
#   - No Agent dispatch found in the recent window (parent wrote changes directly)
#   - Transcript is unreadable

set -euo pipefail

# Pass through when CLAUDE_PROJECT_DIR is unset (e.g. running outside Claude Code)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$PROJECT_DIR" ]; then
  exit 0
fi

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# Check whether the command contains git commit
if ! printf '%s' "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

# Trivial check: commit message has docs: or chore: prefix
COMMIT_MSG=$(printf '%s' "$COMMAND" | grep -oE '(-m|--message)[[:space:]]+["\047]([^"'\'']+)' | tail -1 || true)
if printf '%s' "$COMMIT_MSG" | grep -qE '(docs:|chore:)'; then
  # docs/chore でも staged の状況を確認して trivial なら pass
  STAGED_STAT=$(git -C "$PROJECT_DIR" diff --staged --stat 2>/dev/null || true)
  if [ -z "$STAGED_STAT" ]; then
    exit 0
  fi
  # Get file count and changed line count
  CHANGED_FILES=$(printf '%s' "$STAGED_STAT" | grep -c '|' || true)
  INSERTIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' | head -1 || echo 0)
  DELETIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' | head -1 || echo 0)
  TOTAL_LINES=$(( INSERTIONS + DELETIONS ))
  if [ "$CHANGED_FILES" -le 3 ] && [ "$TOTAL_LINES" -le 20 ]; then
    exit 0
  fi
fi

# Check staged state to determine whether the commit is trivial
STAGED_STAT=$(git -C "$PROJECT_DIR" diff --staged --stat 2>/dev/null || true)
if [ -z "$STAGED_STAT" ]; then
  # No staged changes — commit is trivial or some other condition
  exit 0
fi

CHANGED_FILES=$(printf '%s' "$STAGED_STAT" | grep -c '|' || true)
INSERTIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' | head -1 || echo 0)
DELETIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' | head -1 || echo 0)
TOTAL_LINES=$(( INSERTIONS + DELETIONS ))

# Trivial check 1: at most 1 file and at most 5 lines
if [ "$CHANGED_FILES" -le 1 ] && [ "$TOTAL_LINES" -le 5 ]; then
  exit 0
fi

# Trivial check 2: all changed files are md/json/gitignore-type
ALL_NON_CONFIG=$(git -C "$PROJECT_DIR" diff --staged --name-only 2>/dev/null | grep -vE '\.(md|json|toml|yaml|yml)$|^\.gitignore$' | wc -l | tr -d ' ' || echo 1)
if [ "$ALL_NON_CONFIG" -eq 0 ]; then
  exit 0
fi

# Check the transcript for an Agent completion
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""')
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# Window since the last real user message
WINDOW_LINES=300
TOTAL_TRANSCRIPT_LINES=$(wc -l < "$TRANSCRIPT" | tr -d ' ')
START_LINE=$(( TOTAL_TRANSCRIPT_LINES - WINDOW_LINES ))
if [ "$START_LINE" -lt 1 ]; then
  START_LINE=1
fi

LAST_REAL_USER=$(awk -v start=1 'NR >= start && /"role":"user"/ && !/"tool_use_id"/ && !/<system-reminder>/ && !/<task-notification>/ {print NR}' "$TRANSCRIPT" | tail -1 || true)
if [ -n "${LAST_REAL_USER:-}" ] && [ "$LAST_REAL_USER" -gt "$START_LINE" ]; then
  START_LINE=$LAST_REAL_USER
fi

WINDOW=$(awk -v start="$START_LINE" 'NR >= start' "$TRANSCRIPT")

# Check whether an Agent dispatch appears in the recent window.
# Counting "tool_use_id" occurrences was unreliable — it matched tool_result entries
# from Bash/Edit/Read as "Agent completions". Instead, count assistant tool_use entries
# with "name":"Agent" directly.
HAS_AGENT_DISPATCH=$(printf '%s' "$WINDOW" | grep -v '"tool_use_id"' | grep -c '"name":"Agent"' || true)
if [ "$HAS_AGENT_DISPATCH" -eq 0 ]; then
  # No Agent dispatch — changes were written directly by the parent — do not block
  exit 0
fi

# Agent completion found: check whether requesting-code-review was invoked.
# Use grep -c instead of -q to avoid SIGPIPE on printf under `set -euo pipefail`
# when the WINDOW is large enough that grep can match early.
REVIEW_COUNT=$(printf '%s' "$WINDOW" | grep -c 'superpowers:requesting-code-review' || true)
if [ "${REVIEW_COUNT:-0}" -gt 0 ]; then
  exit 0
fi

REASON="PreToolUse(Bash/git commit): Subagent output has not gone through an independent code review before this commit. Call Skill('superpowers:requesting-code-review') before git commit (see .claude/rules/agents.md \"Before reporting done\"). Trivial docs-only / config-only / single-line changes are exempt — if this hook fired, the staged changes do not meet the trivial criteria."

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
