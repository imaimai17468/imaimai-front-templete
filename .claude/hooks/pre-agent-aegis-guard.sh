#!/usr/bin/env bash
# PreToolUse(Agent) guard (ADR-0013):
# Block subagent dispatch (Agent tool) unless .claude/.aegis-stamp exists.
#
# The stamp is a deterministic artifact:
#   created: post-aegis-compile.sh when aegis_compile_context completes
#   cleared: user-prompt-gate.sh on every user prompt (per-prompt freshness —
#            a single early call must not whitelist the whole session)
#
# Degraded mode: when the Aegis MCP tools are genuinely unavailable in a
# session, the agent writes .claude/.aegis-unavailable with a one-line reason;
# this guard then admits dispatches. The marker is cleared at SessionStart
# (session-start-env-check.sh), so the degrade never outlives the session and
# stays visible in the worktree while it is active.
#
# Exception: subagent_type claude-code-guide / Explore does not require Aegis
# knowledge (CLI Q&A / read-only search), so those are allowed through.
# code-reviewer / spec-verifier are also exempt: they read AGENTS.md and the
# path-scoped rule files directly (they do not consume aegis_compile_context
# output), so requiring a fresh compile_context before /review-diff or
# /verify-spec would only add friction.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

# Skip in subagent (sidechain) sessions — this guard is a parent-only workflow check.
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if head -1 "$TRANSCRIPT" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
case "$SUBTYPE" in
  claude-code-guide|Explore|statusline-setup|keybindings-help|code-reviewer|spec-verifier)
    exit 0
    ;;
esac

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Explicit, auditable degrade: Aegis MCP unavailable in this session.
if [ -f "$ROOT/.claude/.aegis-unavailable" ]; then
  exit 0
fi

if [ -f "$ROOT/.claude/.aegis-stamp" ]; then
  exit 0
fi

REASON="PreToolUse(Agent): no aegis_compile_context call recorded since the last user prompt (.claude/.aegis-stamp is missing). Call aegis_compile_context with target_files / plan / command / intent_tags before dispatching a subagent (see AGENTS.md). For read-only search, use subagent_type Explore instead. If the Aegis MCP tools are genuinely unavailable in this session, write .claude/.aegis-unavailable containing a one-line reason and retry."

jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason
}'
