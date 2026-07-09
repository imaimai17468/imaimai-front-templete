#!/usr/bin/env bash
# UserPromptSubmit hook (ADR-0013):
# 1. Clear .claude/.aegis-stamp — each user prompt opens a fresh consultation
#    window, so a compile_context call from a previous prompt cannot satisfy
#    the pre-agent-aegis-guard for this one.
# 2. Inject a one-line pointer to AGENTS.md. The directives themselves live in
#    AGENTS.md ("Workflow", "Aegis Process Enforcement", "Degraded
#    environments") — this hook deliberately does not duplicate them.

set -euo pipefail

INPUT=$(cat)

# Skip in subagent (sidechain) sessions to avoid infinite recursion.
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if head -1 "$TRANSCRIPT" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
rm -f "$ROOT/.claude/.aegis-stamp"

jq -n '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: "Re-check the Workflow section of AGENTS.md before acting: detect ticket-granularity work (invoke start-workflow yourself), consult Aegis before implementation, and apply the Degraded environments rules when a required tool is missing."
  }
}'
