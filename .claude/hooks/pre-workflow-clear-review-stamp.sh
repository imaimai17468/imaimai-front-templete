#!/usr/bin/env bash
# PreToolUse(Workflow): clear .review-stamp when the review-diff workflow launches.
# The commit gate is then owned by the current run (ADR-0009 fail-closed guarantee):
# a stale stamp from a previous cycle cannot leak through a failed or incomplete review.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Workflow" ]; then
  exit 0
fi

# Skip in subagent (sidechain) sessions — a nested review launch must not
# invalidate the parent session's already-earned stamp.
SIDECHAIN_CHECK=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$SIDECHAIN_CHECK" ] && [ -f "$SIDECHAIN_CHECK" ]; then
  if head -1 "$SIDECHAIN_CHECK" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

NAME=$(printf '%s' "$INPUT" | jq -r '.tool_input.name // ""')
SCRIPT_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.scriptPath // ""')
case "${NAME}:${SCRIPT_PATH}" in
  *review-diff*) ;;
  *) exit 0 ;;
esac

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
rm -f "$ROOT/.claude/.review-stamp"
