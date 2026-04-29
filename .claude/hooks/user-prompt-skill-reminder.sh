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
  REMINDERS+=("計画立案の指示を検知。**EnterPlanMode に入る前に** Skill(\"superpowers:writing-plans\") を invoke してフォーマットを取得し、aegis_compile_context を target_files で呼び、関連 ADR (docs/adr/) を参照してから ExitPlanMode で plan を提示すること。plan は ./.claude/plans/ に保存される。")
fi

if [ $is_creative -eq 1 ]; then
  REMINDERS+=("創作・設計系の指示を検知。CLAUDE.md ルールに従い、コード変更前に **必ず Skill(\"superpowers:brainstorming\") を invoke** して要件を発散・確認すること。「自分で決められる」と思った瞬間が skill 違反のサイン。")
fi

if [ $is_implementation -eq 1 ]; then
  REMINDERS+=("実装系の指示を検知。コード編集に着手する前に: (1) **aegis_compile_context** を target_files / plan / command / **intent_tags 明示** で呼ぶ (このリポでは SLM tagger 無効なので intent_tags 省略 = expanded スキップ。aegis_get_known_tags で catalog を引いてから関連タグを 1〜3 個渡すこと)、(2) チケット粒度なら parent で書かず **subagent ディスパッチ** (model 明示)、(3) subagent が未完了で返ってきたら parent で巻き取らず **新しい subagent を再ディスパッチ**、(4) Presenter / pure function を追加するなら **Skill(\"superpowers:test-driven-development\")** を経由。")
fi

# additionalContext として返す（ユーザーには見せず assistant context に注入）
ADDITIONAL=$(printf '%s\n' "${REMINDERS[@]}")

jq -n --arg ctx "$ADDITIONAL" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
