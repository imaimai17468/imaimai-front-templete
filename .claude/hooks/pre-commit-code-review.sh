#!/usr/bin/env bash
# PreToolUse(Bash) hook:
# Runs the code-reviewer agent on staged changes before git commit.
# Blocks the commit if the agent finds a coding-guide violation.
#
# Trivial commits (docs/config only, ≤1 file & ≤5 lines) are skipped.

set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$PROJECT_DIR" ]; then
  exit 0
fi

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

if ! printf '%s' "$COMMAND" | grep -qE 'git commit'; then
  exit 0
fi

cd "$PROJECT_DIR"

# Determine the diff that WILL be committed.
# PreToolUse runs BEFORE the command executes, so when `git add` is chained
# with `git commit` in the same command (e.g. `git add x; git commit ...`),
# nothing is staged yet. In that case we replay the `git add` into a throwaway
# index so the review still runs against exactly what is about to be committed.
# The real index is never touched.
TMP_INDEX=""
cleanup() {
  [ -n "$TMP_INDEX" ] && rm -f "$TMP_INDEX"
}
trap cleanup EXIT

GIT_DIFF_STAGED="git diff --staged"
STAGED_STAT=$(git diff --staged --stat 2>/dev/null || true)

if [ -z "$STAGED_STAT" ]; then
  # Nothing staged. Replay a chained `git add` (up to the next ; && || |) into a
  # throwaway index copied from the real one.
  ADD_ARGS=$(printf '%s' "$COMMAND" | grep -oE 'git add [^;&|)]*' | head -1 | sed -E 's/^git add[[:space:]]+//')
  if [ -z "$ADD_ARGS" ]; then
    # No staged changes and no `git add` to simulate — nothing to review.
    exit 0
  fi
  GIT_DIR_PATH=$(git rev-parse --git-dir 2>/dev/null || echo ".git")
  TMP_INDEX=$(mktemp)
  cp "$GIT_DIR_PATH/index" "$TMP_INDEX" 2>/dev/null || : >"$TMP_INDEX"
  eval "GIT_INDEX_FILE='$TMP_INDEX' git add $ADD_ARGS" >/dev/null 2>&1 || true
  GIT_DIFF_STAGED="GIT_INDEX_FILE='$TMP_INDEX' git diff --staged"
  STAGED_STAT=$(eval "$GIT_DIFF_STAGED --stat" 2>/dev/null || true)
  if [ -z "$STAGED_STAT" ]; then
    echo '{"systemMessage":"⛔ Pre-commit code review: `git add` と `git commit` が同一コマンドで連結されており、staged diff を特定できません。`git add` を別の tool call で実行してから `git commit` してください。","decision":"block","reason":"git add と git commit を別々の tool call で実行してください（.claude/rules/tools.md 参照）。同一コマンド内の連結は codex レビューを迂回するためブロックします。"}'
    exit 0
  fi
fi

NAME_ONLY=$(eval "$GIT_DIFF_STAGED --name-only" 2>/dev/null || true)

CHANGED_FILES=$(printf '%s' "$STAGED_STAT" | grep -c '|' || true)
INSERTIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' | head -1 || echo 0)
DELETIONS=$(printf '%s' "$STAGED_STAT" | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' | head -1 || echo 0)
TOTAL_LINES=$(( INSERTIONS + DELETIONS ))

# Trivial: ≤1 file and ≤5 lines
if [ "$CHANGED_FILES" -le 1 ] && [ "$TOTAL_LINES" -le 5 ]; then
  exit 0
fi

# Trivial: all files are docs/config
ALL_NON_CONFIG=$(printf '%s' "$NAME_ONLY" | grep -vE '\.(md|json|toml|yaml|yml)$|^\.gitignore$' | wc -l | tr -d ' ' || echo 1)
if [ "$ALL_NON_CONFIG" -eq 0 ]; then
  exit 0
fi

# Exclude shadcn UI primitives from review (auto-generated, not project code)
REVIEW_FILES=$(printf '%s' "$NAME_ONLY" | grep -v '^src/components/ui/' || true)
if [ -z "$REVIEW_FILES" ]; then
  exit 0
fi

# Run code-reviewer agent on the to-be-committed diff (excluding shadcn UI files)
DIFF=$(eval "$GIT_DIFF_STAGED -- $REVIEW_FILES" 2>&1 || true)

read -r -d '' PROMPT <<'EOP' || true
You are a code reviewer for this repository.
Read the coding rules by running: cat .claude/rules/style.md .claude/rules/architecture.md .claude/rules/testing.md .claude/rules/tools.md .claude/rules/hooks.md .claude/rules/agents.md
Then review whether the following staged changes follow those rules.

**Output format (strict)**:
If there is even one violation, write only `BLOCK: <violating file / rule name / brief fix>` on the first line.
If there are no violations, write only `APPROVE` on the first line.
Do not write any other explanation, preamble, or markdown decoration.

=== git diff --staged ===
EOP

FULL_PROMPT=$(printf '%s\n%s' "$PROMPT" "$DIFF")

TEXT=$(printf '%s' "$FULL_PROMPT" \
  | codex exec \
      --ephemeral \
      -s read-only \
      -m gpt-5.4-mini \
      - \
      2>/dev/null)
RC=$?

if [ $RC -ne 0 ] || [ -z "$TEXT" ]; then
  echo '{"systemMessage":"⚠️  Pre-commit code review: agent failed (skipped)"}'
  exit 0
fi

FIRST_LINE=$(printf '%s' "$TEXT" | grep -E '^(APPROVE|BLOCK)' | head -n 1)

if [ -z "$FIRST_LINE" ]; then
  LAST_LINE=$(printf '%s' "$TEXT" | tail -n 1)
  jq -n --arg r "$LAST_LINE" '{systemMessage: ("⚠️ Pre-commit code review: unexpected response — " + $r)}'
elif printf '%s' "$FIRST_LINE" | grep -q '^BLOCK'; then
  REASON=$(printf '%s' "$FIRST_LINE" | sed 's/^BLOCK:[[:space:]]*//')
  jq -n --arg r "$REASON" '{
    systemMessage: ("⛔ Pre-commit code review: violation — " + $r),
    decision: "block",
    reason: ("Code reviewer agent detected a coding-guide violation:\n\n" + $r)
  }'
else
  jq -n '{systemMessage: "✅ Pre-commit code review: approved (codex)"}'
fi

exit 0
