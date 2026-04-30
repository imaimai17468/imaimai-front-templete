#!/usr/bin/env bash
# UserPromptSubmit hook: Inject skill/process reminders on every user prompt.
# No trigger-word detection — always remind so the agent decides applicability.

set -euo pipefail

INPUT=$(cat)

# Skip in subagent (sidechain) sessions to avoid infinite recursion.
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if head -1 "$TRANSCRIPT" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

read -r -d '' REMINDERS <<'EOF' || true
Before taking action, check which of these apply to the current prompt:

- **Ticket-granularity work** (implement a component, fix a non-trivial bug, refactor a module, add a feature): invoke Skill("start-workflow"). The user does NOT need to say "/start-workflow" — detect it yourself.
- **Planning**: If the user asks for planning/design, invoke Skill("superpowers:writing-plans") and enter EnterPlanMode before implementation.
- **Brainstorming**: If the work involves creative/design judgment (new UI, architecture decisions, approach selection), invoke Skill("superpowers:brainstorming") before any code change.
- **Implementation** (when not using start-workflow): Before touching code: (1) call aegis_compile_context with target_files / plan / command / explicit intent_tags, (2) dispatch a subagent (specify model explicitly), (3) when adding a Presenter or pure function, use Skill("superpowers:test-driven-development").
- **Aegis maintenance**: If you edited or created files in `.claude/rules/` or `docs/adr/`, call `aegis_sync_docs` (edits) or `aegis_import_doc` (new files) before finishing. Forgetting this makes Aegis stale.
EOF

jq -n --arg ctx "$REMINDERS" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
