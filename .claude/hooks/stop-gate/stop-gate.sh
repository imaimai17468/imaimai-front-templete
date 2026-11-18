#!/usr/bin/env bash
# Stop gate: `bun run check` (typecheck / lint / format) when the turn changed a
# code-relevant file. A failure blocks the turn once; when the payload says this
# Stop already triggered a followup, it warns instead, so a failure the agent
# cannot fix does not loop.

set -uo pipefail

INPUT=$(cat)

# CLAUDE_PROJECT_DIR is where the session started, and the input's `cwd` is the
# checkout the session works in; in a worktree session those differ, and the
# gate has to judge the tree the turn edited.
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../../.." && pwd)}"
CWD=$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)
if [ -n "$CWD" ] && [ -d "$CWD/.claude/hooks" ]; then
  ROOT="$CWD"
fi

# `stop_hook_active` is Claude Code's "this Stop was already blocked once" flag,
# and Cursor's payload carries `loop_count` instead.
DOWNGRADE_CAUSE=$(printf '%s' "$INPUT" | jq -j \
  'if .stop_hook_active == true then "stop_hook_active" elif (.loop_count // 0) > 0 then "loop_count" else "" end' \
  2>/dev/null || true)

emit_block() { # $1 = summary, $2 = reason body
  if [ -n "$DOWNGRADE_CAUSE" ]; then
    printf '%s\n%s' \
      "⚠️ Stop gate STILL failing (not re-blocking — $DOWNGRADE_CAUSE): $1 — if this failure is pre-existing or unfixable, report it to the user explicitly; do not treat it as passed." \
      "$2" | jq -n --rawfile message /dev/stdin '{systemMessage: $message}'
  else
    printf '%s\n\n%s' "$1" "$2" | jq -n --arg message "⛔ Stop block: $1" --rawfile reason /dev/stdin '{
      systemMessage: $message,
      decision: "block",
      reason: $reason
    }'
  fi
  exit 0
}

cd "$ROOT" || emit_block \
  "the Stop gate could not enter $ROOT, so no check ran." \
  "The directory named by the Stop payload's cwd, or by CLAUDE_PROJECT_DIR, is gone or unreadable."

# A failed `git status` prints nothing on stdout, which would read as a clean
# tree, so its exit status is tested first.
GIT_STATUS=$(git status --porcelain 2>&1)
GIT_STATUS_RC=$?
if [ "$GIT_STATUS_RC" -ne 0 ]; then
  emit_block \
    "the Stop gate could not read git status in $ROOT, so no check ran." \
    "\`git status --porcelain\` exited $GIT_STATUS_RC in $ROOT:
$GIT_STATUS"
fi

[ -z "$GIT_STATUS" ] && exit 0

# --no-renames lists both sides of a rename, and the paths stay whole so a
# filename containing a space still reaches the match below.
CHANGED=$(git diff --name-only --no-renames HEAD 2>/dev/null || true)
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null || true)

holds_code_relevant_file() { # $1 = newline-delimited paths
  local path
  while IFS= read -r path; do
    case "$path" in
      *.ts | *.mts | *.cts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.css)
        return 0
        ;;
    esac
  done <<<"$1"
  return 1
}

if ! holds_code_relevant_file "$(printf '%s\n%s' "$CHANGED" "$UNTRACKED")"; then
  jq -n '{systemMessage: "✅ Stop gate: no code-relevant changes (check skipped)"}'
  exit 0
fi

if ! OUT=$(bun run check 2>&1); then
  emit_block "bun run check failed. Fix before ending the turn." "===== bun run check =====
$OUT"
fi

jq -n '{systemMessage: "✅ Stop gate: typecheck / lint / format pass"}'
exit 0
