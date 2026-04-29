#!/usr/bin/env bash
# UserPromptSubmit hook: 実装系・創作系のプロンプトを検知したら、
# 必須 skill / Aegis 呼び出しを忘れないよう additionalContext で念を押す。
#
# stdin に Claude Code のフック入力 JSON を受け取り、
# トリガー語に該当した場合は hookSpecificOutput.additionalContext を含む
# JSON を出力して exit 0。該当しなければ無音 exit 0。

set -euo pipefail

INPUT=$(cat)
PROMPT=$(printf '%s' "$INPUT" | jq -r '.prompt // ""')

# トリガー語マッチ用に小文字化したコピーを用意（日本語はそのまま）。
LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')

is_creative=0
is_implementation=0
is_planning=0

# 創作・設計系（brainstorming 必須）
if printf '%s' "$LOWER" | grep -qE '(brainstorm|design |考え|設計|アイデア|どう作|どう実装|どう設計)' \
   || printf '%s' "$PROMPT" | grep -qE '(設計|考え|アイデア|構成案)'; then
  is_creative=1
fi

# 実装・コード変更系（aegis_compile_context + subagent dispatch 必須）
if printf '%s' "$LOWER" | grep -qE '(implement|create (a |the )?component|build |refactor|add (a |the )?(component|page|feature)|fix )' \
   || printf '%s' "$PROMPT" | grep -qE '(実装|作って|作成|追加|修正|リファクタ|コンポーネント|機能)'; then
  is_implementation=1
fi

# 計画系（writing-plans + EnterPlanMode 必須）
if printf '%s' "$LOWER" | grep -qE '(plan |make a plan)' \
   || printf '%s' "$PROMPT" | grep -qE '(計画|プラン|plan 組ん|手順を)'; then
  is_planning=1
fi

# どれにも該当しなければ何もしない
if [ $is_creative -eq 0 ] && [ $is_implementation -eq 0 ] && [ $is_planning -eq 0 ]; then
  exit 0
fi

REMINDERS=()

if [ $is_planning -eq 1 ]; then
  REMINDERS+=("Planning request detected. **Before entering EnterPlanMode**, invoke Skill(\"superpowers:writing-plans\") to load the canonical plan format, call aegis_compile_context with the target_files, and check docs/adr/ for relevant ADRs. Only then present the plan via ExitPlanMode. Plans are persisted under ./.claude/plans/.")
fi

if [ $is_creative -eq 1 ]; then
  REMINDERS+=("Creative / design request detected. Per CLAUDE.md, you MUST invoke Skill(\"superpowers:brainstorming\") before any code change to elicit and confirm requirements. The moment you feel you can decide on your own is the moment you are skipping the skill.")
fi

if [ $is_implementation -eq 1 ]; then
  REMINDERS+=("Implementation request detected. Before any code edit: (1) call **aegis_compile_context** with target_files / plan / command / **explicit intent_tags** (the SLM tagger is disabled in this repo, so omitting intent_tags means expanded is empty — call aegis_get_known_tags first and pass 1–3 relevant tags); (2) for ticket-granularity work, do NOT write in the parent — **dispatch a subagent** (with explicit model); (3) if a subagent returns incomplete, do NOT pick up the remainder in the parent — **dispatch a new subagent**; (4) when adding a Presenter or pure function, go through **Skill(\"superpowers:test-driven-development\")**.")
fi

# additionalContext として返す（ユーザーには見せず assistant context に注入）
ADDITIONAL=$(printf '%s\n' "${REMINDERS[@]}")

jq -n --arg ctx "$ADDITIONAL" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
