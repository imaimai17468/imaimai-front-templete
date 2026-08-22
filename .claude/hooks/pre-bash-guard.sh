#!/usr/bin/env bash
# PreToolUse(Bash) combined guard:
# 1. .env protection — block any command referencing the protected env files.
#    permissions.deny stops Read/Write/Edit, but allowed Bash readers (cat,
#    grep, head, tail, redirections) could walk around it.
# 2. find gate — prompt for the `find` shapes that reach past the deny list or
#    run/delete, while leaving scoped path discovery unattended.

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

# Two harnesses invoke this file. Claude Code sends tool_name "Bash"; Cursor's
# third-party hook loader runs the same registration but delivers its own
# payload, where the terminal tool is named "Shell" (payload captured in this
# repository on 2026-08-07, Cursor 3.14.27 — the event name arrives as
# "preToolUse" and CLAUDE_PROJECT_DIR is provided as a compatibility alias).
# Anything else (Read, Task, MCP tools) passes through.
case "$TOOL" in
  Bash|Shell) ;;
  *) exit 0 ;;
esac

# Emit a deny in both dialects at once: Claude Code reads the legacy
# decision/reason pair (scripts/test-bash-guard.py keys on the literal
# "block"), Cursor reads hookSpecificOutput.permissionDecision. Cursor was
# observed honoring exactly this combined output (a guard in this file blocked a
# live command in a Cursor session, 2026-08-07). Claude Code has NOT been observed
# parsing the combined shape — both fields agree on the outcome, so the
# accepted risk is a parser that rejects the coexistence outright, not a
# divergent decision; one live Claude Code smoke test of any deny site would
# settle it.
deny() { # $1 = reason
  jq -n --arg reason "$1" '{
    decision: "block",
    reason: $reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
}

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')

# --- Guard 1: .env protection (applies to parent and sidechains alike) ---
# Scrub the committed example files, then look for a token that *starts* with
# `.env` (optionally `.env.local` / `.env.development` / `.env.production`).
# For git commands only, -m/--message quoted bodies are also scrubbed first:
# prose about env files in a commit/tag message is not file access. The scrub
# is deliberately NOT applied to other commands — a quoted message flag can be
# repurposed as a file argument elsewhere (e.g. `sort -m ".env"`).
#
# A `-F -` body arrives as a heredoc, so the same prose reaches this guard by a
# route the -m scrub does not cover. It is dropped only when the command's last
# line is the heredoc delimiter: then nothing follows the body, so nothing is
# hidden. A redirect belongs to the operator line, which is kept either way, and
# a command chained after the terminator leaves a different last line and blocks
# the scrub.
SCRUBBED=$(printf '%s' "$CMD" | sed 's/\.env[.A-Za-z]*\.example//g')
# NR==1 with an exit: awk would otherwise print the first field of every line,
# and a multi-line command (a heredoc body) then matched no first word at all.
FIRST_WORD=$(printf '%s' "$SCRUBBED" | awk 'NR == 1 { print $1; exit }')
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
  SCRUBBED=$(printf '%s' "$SCRUBBED" | awk '
    BEGIN { q = sprintf("%c", 39); op = 0 }
    NR == 1 { first = $0 }
    { last = $0; lines[NR] = $0 }
    op == 0 && /<<-?[ \t]*[^ \t]/ {
      op = NR
      d = $0
      sub(/^.*<<-?[ \t]*/, "", d)
      gsub(/["]/, "", d)
      gsub(q, "", d)
      sub(/[ \t].*$/, "", d)
    }
    END {
      trimmed = last
      sub(/^[ \t]+/, "", trimmed)
      sub(/[ \t]+$/, "", trimmed)
      keep = (op > 0 && d != "" && trimmed == d) ? op : NR
      for (i = 1; i <= keep; i++) print lines[i]
    }
  ')
fi
if printf '%s' "$SCRUBBED" | grep -qE '(^|[[:space:]"'\''`={}:,;&|<>(/-])\.env(\.(local|development|production))?([[:space:]"'\''`{}:,;&|<>)*]|$)'; then
  deny "PreToolUse(Bash): this command references a protected env file (.env / .env.local / .env.development / .env.production). Reading or writing these is denied regardless of tool. Use .env.local.example for documented placeholders. If this is a false positive (e.g. the literal string in a message), rephrase the command without the filename."
  exit 0
fi

# Whitespace-normalized command, shared by the guards below: irregular spacing
# ("git  commit", tabs, newlines) must not slip past a match.
NORM=$(printf '%s' "$CMD" | tr -s '[:space:]' ' ')

# --- Guard 2: find with broad reach, or an action that runs or deletes ---
# `find` itself is allow-listed: path discovery is
# routine agent work and prompting for every `find node_modules/...` bought
# nothing. Two shapes are not routine, and this guard prompts for them instead of
# letting the allow rule through:
#
#   - A broad search root. `find . -type f | xargs cat` reads every file in the
#     repository — including the local env file, which under the standing
#     drizzle-kit exception can hold a real D1 API token — using only allow-listed commands.
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
  deny "PreToolUse(Bash): this \`find\` is refused because ${FIND_ASK}. A find scoped to a subdirectory, without -exec/-execdir/-ok/-okdir/-delete/-fprint/-fls, runs unattended — narrow it if that is enough. If the broad form is genuinely needed, ask the user to run it."
  exit 0
fi

exit 0
