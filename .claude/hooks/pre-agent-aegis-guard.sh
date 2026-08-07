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
# Exemptions: the `case` statement below IS the list — read it, do not read this
# comment for the membership. Two kinds of agent are exempt, and the test for adding
# one is which kind it is:
#   1. It does not consume `aegis_compile_context` output. The pinned review/spec
#      agents read AGENTS.md and the path-scoped rule files directly, so requiring a
#      fresh compile before /review-diff or /verify-spec would only add friction.
#   2. It does no repository work that architecture rules govern — CLI Q&A,
#      read-only search, harness-provided configuration helpers.
# An earlier version of this comment enumerated the members instead and drifted:
# it named six while the `case` held eight, so the two harness helpers looked
# unauthorised to anyone who trusted the prose over the code.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

# Claude Code names the dispatch tool "Agent"; Cursor's third-party hook loader
# runs this same registration and names it "Task" (see pre-bash-guard.sh for the
# 2026-08-07 payload capture this rests on).
case "$TOOL" in
  Agent|Task) ;;
  *) exit 0 ;;
esac

# Skip in subagent (sidechain) sessions — this guard is a parent-only workflow check.
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if head -1 "$TRANSCRIPT" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
# `Explore`/`explore` and the two guide helpers differ only in which harness
# spawns them; `explore` and `cursor-guide` are Cursor's names for the same two
# exemption kinds (read-only search; harness Q&A that touches no repository code).
case "$SUBTYPE" in
  claude-code-guide|Explore|statusline-setup|keybindings-help|code-reviewer|spec-verifier|explore|cursor-guide)
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

# Both dialects at once — Claude Code reads decision/reason, Cursor reads
# hookSpecificOutput.permissionDecision (see pre-bash-guard.sh).
jq -n --arg reason "$REASON" '{
  decision: "block",
  reason: $reason,
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
