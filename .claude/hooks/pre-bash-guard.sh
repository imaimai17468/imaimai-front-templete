#!/usr/bin/env bash
# PreToolUse(Bash) combined guard (ADR-0013):
# 1. .env protection — block any command referencing the protected env files.
#    permissions.deny stops Read/Write/Edit, but allowed Bash readers (cat,
#    grep, head, tail, redirections) could walk around it (ADR-0004 amendment).
# 2. find gate — prompt for the `find` shapes that reach past the deny list or
#    run/delete, while leaving scoped path discovery unattended.
# 3. Commit gate — block `git commit` while .claude/.review-stamp is missing.

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

# Whitespace-normalized command, shared by the guards below: irregular spacing
# ("git  commit", tabs, newlines) must not slip past a match.
NORM=$(printf '%s' "$CMD" | tr -s '[:space:]' ' ')

# --- Guard 2: find with broad reach, or an action that runs or deletes ---
# `find` itself is allow-listed (ADR-0004, amended 2026-07-29): path discovery is
# routine agent work and prompting for every `find node_modules/...` bought
# nothing. Two shapes are not routine, and this guard prompts for them instead of
# letting the allow rule through:
#
#   - A broad search root. `find . -type f | xargs cat` reads every file in the
#     repository — including the local env file, which under ADR-0017's standing
#     exception can hold a real D1 API token — using only allow-listed commands.
#     Guard 1 never sees it because the command text contains no `.env` literal.
#     So the reach has to be judged from the root, not from the action.
#   - `-exec` / `-delete` and relatives. These reach past the `rm -rf` prefixes in
#     `deny` and can run an arbitrary command per match.
#
# Over-matching is the safe direction here: an unnecessary prompt costs a
# keystroke, a missed one costs the boundary.
#
# This walks tokens instead of matching one regex, because the first draft did
# the latter and a reviewer defeated it twice: anchoring on the character after
# `find ` meant `find "." -type f` slipped through (the quote shifts it), and
# `find` takes MORE THAN ONE starting path, so `find src / -type f` hid a broad
# root behind a narrow one. Quotes are stripped and every leading operand is
# checked.
FIND_ASK=""
# Everything from the first heredoc/herestring operator onward is data, not a
# command — a commit message describing `find . | xargs cat` must not trip this.
# Guard 1 scrubs `-m` bodies for the same reason; this is the heredoc case, found
# when the first version of this guard refused the commit that introduced it.
NORM_FIND=$(printf '%s' "${NORM%%<<*}" | tr -d "'\"\`")
while IFS= read -r SEG; do
  [ -n "$FIND_ASK" ] && break
  case " $SEG " in
    *' find '*) ;;
    *) continue ;;
  esac
  SAW_FIND=0
  ROOT_COUNT=0
  IN_PREDICATES=0
  for TOK in $SEG; do
    if [ "$SAW_FIND" -eq 0 ]; then
      [ "$TOK" = find ] && SAW_FIND=1
      continue
    fi
    case "$TOK" in
      # An action that runs a command or deletes, wherever it appears.
      -exec|-execdir|-ok|-okdir|-delete|-fprint|-fprintf|-fls)
        FIND_ASK="it carries an action that runs a command or deletes files"
        break
        ;;
      # Any other flag ends the operand list; the rest are predicate values.
      -*) IN_PREDICATES=1 ;;
      *)
        [ "$IN_PREDICATES" -eq 1 ] && continue
        ROOT_COUNT=$((ROOT_COUNT + 1))
        case "$TOK" in
          . | ./ | .. | ../ | /* | '~'* | '$'* | *'..'*)
            FIND_ASK="a search root reaches the whole repository (or outside it), so it can read files the deny list protects"
            break
            ;;
        esac
        ;;
    esac
  done
  # `find -name x` with no operand searches the working directory implicitly.
  if [ -z "$FIND_ASK" ] && [ "$SAW_FIND" -eq 1 ] && [ "$ROOT_COUNT" -eq 0 ]; then
    FIND_ASK="it names no search root, so it searches the working directory"
  fi
done <<EOF
$(printf '%s' "$NORM_FIND" | tr ';|&' '\n')
EOF
if [ -n "$FIND_ASK" ]; then
  # Blocks rather than prompts. A hook's `permissionDecision: "ask"` is a valid
  # value, but the documented precedence only settles that a *blocking* hook
  # overrides an `allow` rule — which this file's Guard 1 proves in practice by
  # stopping allow-listed `cat .env.local`. Whether a hook's `ask` prompts for an
  # already-allowed command is unstated, and a guard that silently does nothing
  # is worse than a strict one. Revisit if that behaviour is ever confirmed.
  jq -n --arg why "$FIND_ASK" '{
    decision: "block",
    reason: ("PreToolUse(Bash): this `find` is refused because " + $why + " (ADR-0004, amended 2026-07-29). A find scoped to a subdirectory, without -exec/-execdir/-ok/-okdir/-delete/-fprint/-fls, runs unattended — narrow it if that is enough. If the broad form is genuinely needed, ask the user to run it.")
  }'
  exit 0
fi

# --- Guard 3: commit gate (parent session only) ---
# Treat any `commit` word after `git` in the same shell command (no ;|&
# crossing) as a commit. Deliberately loose: option chains like
# `git -C <path> commit` must match, and over-blocking (e.g. a file literally
# named commit) is the safe failure mode — under-blocking bypasses the review
# gate.
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
    reason: "PreToolUse(Bash): the review gate has not been stamped. Dispatch the code-reviewer agent, then the review-verifier agent (or run /review-diff), on the uncommitted diff before committing. Fixing what the verifier confirms does not require another review (ADR-0019) — the stamp survives those edits, so commit once the findings are addressed."
  }'
  exit 0
fi

exit 0
