#!/usr/bin/env bash
# Stop hook: verify newly added components actually work in the browser via headless Claude + chrome-devtools MCP.
# Confirms with an AI's eye what Level 1 (smoke) cannot catch: "exists / visible / behaves".

set -uo pipefail

# Recursion guard
if [ "${CLAUDE_STOP_HOOK_RECURSION:-}" = "1" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
MODEL="claude-opus-4-7"

cd "$ROOT"

# Stay completely silent when git is clean
if [ -z "$(git status --porcelain)" ]; then
  exit 0
fi

# Find newly added .tsx component files (untracked or added)
# - Exclude shadcn (src/components/ui/), test files, page.tsx / layout.tsx / route.ts
NEW_FILES=$( (git ls-files --others --exclude-standard; git diff --name-only --diff-filter=A HEAD 2>/dev/null) \
  | grep -E '\.(tsx)$' \
  | grep -v -E '(src/components/ui/|\.test\.tsx$|/page\.tsx$|/layout\.tsx$)' \
  | sort -u || true)

if [ -z "$NEW_FILES" ]; then
  echo '{"systemMessage":"✅ Stop component verify: no new components, skipped"}'
  exit 0
fi

# Whether dev server is running (unlike Playwright, we do not auto-start it here)
if ! curl -sf -o /dev/null -m 2 http://localhost:3000; then
  echo '{"systemMessage":"⚠️ Stop component verify: dev server not running, skipped (start with `bun run dev` to enable verification next time)"}'
  exit 0
fi

# Prompt for the headless Claude call
read -r -d '' PROMPT <<EOP || true
You are a UI behavior verification agent. Confirm in the browser that components newly added in this turn actually work as expected on screen.

**New components**:
${NEW_FILES}

**Available MCP tools**: chrome-devtools (navigate_page, take_snapshot, list_console_messages, evaluate_script, etc.)

**dev server**: running at http://localhost:3000

**Procedure**:
1. Read each new component to understand what it does
2. Use Grep to locate where it is imported (until you reach \`src/app/**/page.tsx\`)
3. Identify the URL of the page that uses it (e.g., \`src/app/profile/page.tsx\` → \`/profile\`)
4. navigate_page to that URL via chrome-devtools MCP
5. Run take_snapshot to inspect the DOM and verify **the component's expected elements / text actually exist**
6. Check list_console_messages for runtime errors
7. If possible, also use evaluate_script to confirm dynamic behavior (setInterval, etc.)

**Components not wired to any page**: cannot be verified, treat as WARN (do not block).

**Output format (strict)**:
- All components healthy: write \`APPROVE\` on the first line
- Something is broken: write \`BLOCK: <component name - concrete failure and fix>\` on the first line
- Only unwired components: write \`WARN: <component name> is not wired to any page\` on the first line
Do not write JSON or any extra explanation.
EOP

RESULT=$(printf '%s' "$PROMPT" \
  | CLAUDE_STOP_HOOK_RECURSION=1 claude -p \
      --model "$MODEL" \
      --output-format json \
      --allowed-tools "Read Grep Glob Bash(curl:*) mcp__chrome-devtools__*" \
      2>&1) || {
  echo '{"systemMessage":"⚠️ Stop component verify: claude -p launch failed (skipped)"}'
  exit 0
}

TEXT=$(printf '%s' "$RESULT" | jq -r '.result // empty' 2>/dev/null)
if [ -z "$TEXT" ]; then
  TEXT="$RESULT"
fi

FIRST_LINE=$(printf '%s' "$TEXT" | head -n 1)

if printf '%s' "$FIRST_LINE" | grep -q '^BLOCK'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^BLOCK:[[:space:]]*//')
  jq -n --arg r "$REASON" '{
    systemMessage: ("⛔ Stop component verify: malfunction — " + $r),
    decision: "block",
    reason: ("Component verification detected a problem in a new component:\n\n" + $r)
  }'
elif printf '%s' "$FIRST_LINE" | grep -q '^WARN'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^WARN:[[:space:]]*//')
  jq -n --arg r "$REASON" '{systemMessage: ("⚠️ Stop component verify: " + $r)}'
elif printf '%s' "$FIRST_LINE" | grep -q '^APPROVE'; then
  echo '{"systemMessage":"✅ Stop component verify: new components verified"}'
else
  jq -n --arg r "$FIRST_LINE" '{systemMessage: ("⚠️ Stop component verify: unexpected response — " + $r)}'
fi

exit 0
