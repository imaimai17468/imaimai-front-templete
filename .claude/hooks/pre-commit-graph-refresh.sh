#!/usr/bin/env bash
# PreToolUse(Bash) hook:
# When the agent runs `git commit` and src/ files are staged,
# regenerate code-graph.json and stage the result.
# Runs alongside pre-commit-review-reminder.sh on the same
# Bash matcher — both fire on every Bash call, each filters
# for git commit internally.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')
case "$CMD" in
  *git\ commit*|*git\ -c\ *commit*) ;;
  *) exit 0 ;;
esac

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

if git -C "$ROOT" diff --cached --name-only | grep -q '^src/'; then
  (cd "$ROOT" && bun run graph 2>/dev/null)
  git -C "$ROOT" add .claude/code-graph.json 2>/dev/null || true
fi

exit 0
