#!/usr/bin/env bash
# Stop hook: run a coding-guide review using headless Claude.
# Agent-type hooks are not available on the Stop event, so we work around it by calling `claude -p` from a command-type hook.

set -uo pipefail

# Recursion guard: prevent the inner `claude -p` from re-invoking this hook
if [ "${CLAUDE_STOP_HOOK_RECURSION:-}" = "1" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
MODEL="claude-opus-4-7"

cd "$ROOT"

# Skip immediately when there are no changes (do not fire on conversation turns)
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi


STATUS=$(git status --porcelain 2>&1 || true)
DIFF=$(git diff HEAD 2>&1 || true)

# Prompt (force a strict output format)
read -r -d '' PROMPT <<'EOP' || true
You are a code reviewer. Read this repository's `.claude/rules/*.md` (style / architecture / testing / dependencies / tools), then review whether the following uncommitted changes follow the rules.

**Rule highlights**:
- Coding Style: no loops / no Tailwind arbitrary values / no color-opacity modifier
- Architecture: Directory-First Layout / Container-Presenter separation / One Component Per File / Props-Driven Design / pure-function extraction
- Dependencies: package.json must use exact version pinning
- Exception areas: `src/components/ui/*` and `src/lib/utils.ts` (shadcn-derived, page-level rules do not apply)

**Output format (strict)**:
If there is even one violation, write only `BLOCK: <violating file / rule name / brief fix>` on the first line.
If there are no violations, write only `APPROVE` on the first line.
Do not write any other explanation, preamble, or markdown decoration.
EOP

# Launch headless Claude
RESULT=$(printf '%s\n\n=== git status ===\n%s\n\n=== git diff HEAD ===\n%s\n' "$PROMPT" "$STATUS" "$DIFF" \
  | CLAUDE_STOP_HOOK_RECURSION=1 claude -p --model "$MODEL" --output-format json 2>&1) || {
    echo '{"systemMessage":"⚠️ Stop agent review: claude -p launch failed (skipped)"}'
    exit 0
  }

# Extract result
TEXT=$(printf '%s' "$RESULT" | jq -r '.result // empty' 2>/dev/null)
if [ -z "$TEXT" ]; then
  TEXT="$RESULT"
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
