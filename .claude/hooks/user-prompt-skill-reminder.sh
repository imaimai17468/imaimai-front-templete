#!/usr/bin/env bash
# UserPromptSubmit hook: Detect implementation/creative prompts and inject
# additionalContext reminders for required skill / Aegis calls.
#
# Reads the Claude Code hook input JSON from stdin.
# Outputs hookSpecificOutput.additionalContext JSON when a trigger matches,
# or exits silently with exit 0 when no trigger matches.

set -euo pipefail

INPUT=$(cat)

# Skip reminder injection in subagent (sidechain) sessions.
# The "dispatch a subagent" / "do not pick up in parent" guidance is meant for
# the parent session — a subagent receiving these reminders during its own
# briefing prompt would interpret them as instructions to dispatch yet another
# subagent, leading to infinite recursion or stalls.
# Detect sidechain via the first transcript entry's isSidechain flag.
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if head -1 "$TRANSCRIPT" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // ""')

# Lowercase copy for trigger matching (Japanese characters are left as-is).
LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

is_creative=0
is_implementation=0
is_planning=0

# Creative/design prompts (brainstorming required)
if printf '%s' "$LOWER" | grep -qE '(brainstorm|design |考え|設計|アイデア|どう作|どう実装|どう設計)' \
   || printf '%s' "$PROMPT" | grep -qE '(設計|考え|アイデア|構成案)'; then
  is_creative=1
fi

# Implementation/code-change prompts (aegis_compile_context + subagent dispatch required)
if printf '%s' "$LOWER" | grep -qE '(implement|create (a |the )?component|build |refactor|add (a |the )?(component|page|feature)|fix )' \
   || printf '%s' "$PROMPT" | grep -qE '(実装|作って|作成|追加|修正|リファクタ|コンポーネント|機能)'; then
  is_implementation=1
fi

# Planning prompts (writing-plans + EnterPlanMode required)
if printf '%s' "$LOWER" | grep -qE '(plan |make a plan)' \
   || printf '%s' "$PROMPT" | grep -qE '(計画|プラン|plan 組ん|手順を)'; then
  is_planning=1
fi

# No trigger matched — exit silently
if [ $is_creative -eq 0 ] && [ $is_implementation -eq 0 ] && [ $is_planning -eq 0 ]; then
  exit 0
fi

REMINDERS=()

if [ $is_planning -eq 1 ]; then
  REMINDERS+=("Planning instruction detected. **Before entering EnterPlanMode**, invoke Skill(\"superpowers:writing-plans\") to load the format, call aegis_compile_context with target_files, reference related ADRs in docs/adr/, then present the plan via ExitPlanMode. The plan is saved to ./.claude/plans/.")
fi

if [ $is_creative -eq 1 ]; then
  REMINDERS+=("Creative/design instruction detected. Per CLAUDE.md, **always invoke Skill(\"superpowers:brainstorming\")** before any code change to expand and confirm requirements. Thinking 'I can decide this myself' is the signal that you are violating the skill rule.")
fi

if [ $is_implementation -eq 1 ]; then
  REMINDERS+=("Implementation instruction detected. Before touching any code: (1) call **aegis_compile_context** with target_files / plan / command / **explicit intent_tags** (SLM tagger is disabled in this repo — omitting intent_tags skips expanded context; call aegis_get_known_tags first and pass 1-3 relevant tags), (2) for ticket-granularity work, do not write in the parent — **dispatch a subagent** (specify model explicitly), (3) if a subagent returns incomplete, do not pick up the work in the parent — **re-dispatch a new subagent**, (4) when adding a Presenter or pure function, go through **Skill(\"superpowers:test-driven-development\")** first.")
fi

# Return as additionalContext (injected into assistant context, not shown to the user)
ADDITIONAL=$(printf '%s\n' "${REMINDERS[@]}")

jq -n --arg ctx "$ADDITIONAL" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
