#!/usr/bin/env bash
# Stop hook: run a coding-guide review using Codex CLI (codex exec).
# Codex automatically reads AGENTS.md which references .claude/rules/*.md.
# The model is expected to read those rule files via its sandbox shell access.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
TMPOUT=$(mktemp)

cd "$ROOT"

# Skip when there are no changes
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

STATUS=$(git status --porcelain 2>&1 || true)
DIFF=$(git diff HEAD 2>&1 || true)

read -r -d '' PROMPT <<'EOP' || true
You are a code reviewer for this repository.
Read the coding rules in .claude/rules/*.md (style.md, architecture.md, testing.md, dependencies.md, tools.md).
Then review whether the following uncommitted changes follow those rules.

**Output format (strict)**:
If there is even one violation, write only `BLOCK: <violating file / rule name / brief fix>` on the first line.
If there are no violations, write only `APPROVE` on the first line.
Do not write any other explanation, preamble, or markdown decoration.

=== git status ===
EOP

FULL_PROMPT=$(printf '%s\n%s\n\n=== git diff HEAD ===\n%s\n' "$PROMPT" "$STATUS" "$DIFF")

printf '%s' "$FULL_PROMPT" \
  | codex exec --ephemeral -s read-only -o "$TMPOUT" - >/dev/null 2>&1
RC=$?

TEXT=$(cat "$TMPOUT" 2>/dev/null || true)
rm -f "$TMPOUT"

if [ $RC -ne 0 ] || [ -z "$TEXT" ]; then
  echo '{"systemMessage":"⚠️  Stop agent review: codex exec failed (skipped)"}'
  exit 0
fi

FIRST_LINE=$(printf '%s' "$TEXT" | head -n 1)

if printf '%s' "$FIRST_LINE" | grep -q '^BLOCK'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^BLOCK:[[:space:]]*//')
  jq -n --arg r "$REASON" '{
    systemMessage: ("⛔ Stop agent review: coding-guide violation — " + $r),
    decision: "block",
    reason: ("Stop agent review detected a coding-guide violation:\n\n" + $r)
  }'
elif printf '%s' "$FIRST_LINE" | grep -q '^APPROVE'; then
  echo '{"systemMessage":"✅ Stop agent review: coding-guide compliant"}'
else
  jq -n --arg r "$FIRST_LINE" '{systemMessage: ("⚠️ Stop agent review: unexpected response — " + $r)}'
fi

exit 0
