#!/usr/bin/env bash
# PreToolUse(Bash) combined guard (ADR-0013):
# 1. .env protection — block any command referencing the protected env files.
#    permissions.deny stops Read/Write/Edit, but allowed Bash readers (cat,
#    grep, head, tail, redirections) could walk around it (ADR-0004 amendment).
# 2. Commit gate — block `git commit` while .claude/.review-stamp is missing.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# --- Guard 1: .env protection (applies to parent and sidechains alike) ---
# Scrub the committed example files, then look for a token that *starts* with
# `.env` (optionally `.env.local` / `.env.development` / `.env.production`).
# For git commands only, -m/--message quoted bodies are also scrubbed first:
# prose about env files in a commit/tag message is not file access. The scrub
# is deliberately NOT applied to other commands — a quoted message flag can be
# repurposed as a file argument elsewhere (e.g. `sort -m ".env"`).
SCRUBBED=$(printf '%s' "$CMD" | sed 's/\.env[.A-Za-z]*\.example//g')
FIRST_WORD=$(printf '%s' "$SCRUBBED" | awk '{print $1}')
if [ "$FIRST_WORD" = "git" ]; then
  # Single-quoted bodies are always inert (no expansion inside single quotes).
  SCRUBBED=$(printf '%s' "$SCRUBBED" | sed \
    -e "s/-\{1,2\}m\(essage\)\{0,1\}\(=\| \)\{0,1\}'[^']*'//g")
  # Double-quoted bodies expand $(...) / ${...} / backticks, so scrub them
  # only when the command contains no substitution opener at all. A bare `$`
  # (e.g. "$5/mo") is inert and still scrubs; any backtick is conservatively
  # treated as a potential pair (= execution) and blocks scrubbing.
  case "$SCRUBBED" in
    *'$('*|*'${'*|*'`'*) ;;
    *)
      SCRUBBED=$(printf '%s' "$SCRUBBED" | sed \
        -e 's/-\{1,2\}m\(essage\)\{0,1\}\(=\| \)\{0,1\}"[^"]*"//g')
      ;;
  esac
fi
if printf '%s' "$SCRUBBED" | grep -qE '(^|[[:space:]"'\''`={}:,;&|<>(/-])\.env(\.(local|development|production))?([[:space:]"'\''`{}:,;&|<>)*]|$)'; then
  jq -n '{
    decision: "block",
    reason: "PreToolUse(Bash): this command references a protected env file (.env / .env.local / .env.development / .env.production). Reading or writing these is denied regardless of tool (ADR-0004, amended by ADR-0013). Use .env.local.example for documented placeholders. If this is a false positive (e.g. the literal string in a message), rephrase the command without the filename."
  }'
  exit 0
fi

# --- Guard 2: commit gate (parent session only) ---
# Normalize whitespace first so irregular spacing ("git  commit", tabs) cannot
# slip past the match, then treat any `commit` word after `git` in the same
# shell command (no ;|& crossing) as a commit. Deliberately loose: option
# chains like `git -C <path> commit` must match, and over-blocking (e.g. a
# file literally named commit) is the safe failure mode — under-blocking
# bypasses the review gate.
NORM=$(printf '%s' "$CMD" | tr -s '[:space:]' ' ')
if ! printf '%s' "$NORM" | grep -qE '(^|[;&| ])git [^;&|]*\bcommit\b'; then
  exit 0
fi

# Skip in subagent (sidechain) sessions.
SIDECHAIN_CHECK=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$SIDECHAIN_CHECK" ] && [ -f "$SIDECHAIN_CHECK" ]; then
  if head -1 "$SIDECHAIN_CHECK" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

if [ ! -f "$ROOT/.claude/.review-stamp" ]; then
  jq -n '{
    decision: "block",
    reason: "PreToolUse(Bash): the review gate has not been stamped. Dispatch the code-reviewer agent (or run /review-diff) on the uncommitted diff before committing. Note: any Edit/Write after a review clears the stamp (ADR-0013), so post-review fixes require a re-review."
  }'
  exit 0
fi

exit 0
