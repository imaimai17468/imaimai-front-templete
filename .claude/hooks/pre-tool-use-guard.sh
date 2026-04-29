#!/usr/bin/env bash
# PreToolUse guard: Reject mechanically detectable coding-guide violations at the entry point.
# Reads Claude Code hook input JSON from stdin; outputs a deny-decision JSON when violations are found.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""')

case "$TOOL" in
  Edit)
    CONTENT=$(printf '%s' "$INPUT" | jq -r '.tool_input.new_string // ""')
    ;;
  Write)
    CONTENT=$(printf '%s' "$INPUT" | jq -r '.tool_input.content // ""')
    ;;
  MultiEdit)
    CONTENT=$(printf '%s' "$INPUT" | jq -r '[.tool_input.edits[]?.new_string] | join("\n")')
    ;;
  *)
    exit 0
    ;;
esac

# Skip shadcn exception zones
case "$FILE" in
  */src/components/ui/*|*/src/lib/utils.ts)
    exit 0
    ;;
esac

REASONS=""

# .ts / .tsx / .js / .jsx 系のみコードルール適用
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    # Tailwind arbitrary value: w-[327px] / text-[#fff] / bg-[rgb(...)] 等
    if printf '%s' "$CONTENT" | grep -qE '(^|[^a-zA-Z-])(w|h|p|m|gap|inset|top|bottom|left|right|text|bg|border|rounded|shadow|translate|scale|rotate|space|grid|col|row|size|min-w|min-h|max-w|max-h)-\['; then
      REASONS="${REASONS}- Tailwind arbitrary value \`[...]\` 禁止 (coding-guide)。サイズは Tailwind v4 の --spacing ベース整数クラス (w-80 / w-327) を使い、色・フォントサイズ・半径は globals.css にトークン追加してから参照する。\n"
    fi

    # 色の透明度修飾子: text-gray-800/80 / bg-blue-600/50 等
    if printf '%s' "$CONTENT" | grep -qE '(text|bg|border|fill|stroke|ring|outline|divide|from|via|to|decoration|accent|caret|placeholder)-[a-z]+-[0-9]+/[0-9]+'; then
      REASONS="${REASONS}- 色の透明度修飾子 \`-XXX/YY\` 禁止 (coding-guide)。薄くするなら別のシェードクラスに切り替え。半透明が必要なオーバーレイ等は globals.css に専用カラートークン追加。\n"
    fi

    # for / while ループ
    if printf '%s' "$CONTENT" | grep -qE '\b(for|while)\s*\('; then
      REASONS="${REASONS}- ループ (\`for\` / \`while\`) 禁止 (coding-guide)。map / filter / reduce / flatMap / forEach / some / every / find を使う。\n"
    fi
    ;;
esac

# package.json の version range
case "$FILE" in
  *package.json)
    if printf '%s' "$CONTENT" | grep -qE '"[\^~][0-9]'; then
      REASONS="${REASONS}- package.json は exact version pinning (coding-guide)。\`^\` / \`~\` / major-only 表記禁止。\`bun add -E <pkg>\` で追加、既存分は手動で exact に直す。\n"
    fi
    ;;
esac

if [ -n "$REASONS" ]; then
  printf '%s' "$REASONS" | jq -Rs --arg file "$FILE" '{
    systemMessage: ("⛔ PreToolUse deny: coding-guide 違反 — " + $file + "\n" + .),
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("coding-guide 違反を検出しました。以下を修正してから再度書いてください:\n\n" + .)
    }
  }'
fi

exit 0
