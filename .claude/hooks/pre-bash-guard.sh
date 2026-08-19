#!/usr/bin/env bash
# PreToolUse(Bash) combined guard:
# 1. .env protection — block any command referencing the protected env files.
#    permissions.deny stops Read/Write/Edit, but allowed Bash readers (cat,
#    grep, head, tail, redirections) could walk around it.
# 2. find gate — prompt for the `find` shapes that reach past the deny list or
#    run/delete, while leaving scoped path discovery unattended.
# 3. Gate-marker protection — refuse any command naming the review gate's own
#    marker files, so Bash cannot forge the artifact Guard 4 keys on.
# 4. Commit gate — block a commit while the review stamp is missing.

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
# decision/reason pair (scripts/test-review-gate.py keys on the literal
# "block"), Cursor reads hookSpecificOutput.permissionDecision. Cursor was
# observed honoring exactly this combined output (Guard 3 blocked a live
# command in a Cursor session, 2026-08-07). Claude Code has NOT been observed
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

# --- Guard 3: the review gate's own markers are not writable from Bash ---
# The gate keys on artifacts under `.claude/` that only hooks are meant to create.
# Nothing stopped a Bash command from creating one: `Bash(touch:*)` is allow-listed,
# so `touch .claude/.review-stamp` forged a stamp and satisfied Guard 4 with no
# review having happened at all (verified 2026-07-30). The only thing standing
# against that was a sentence in the `review-diff` skill telling the agent not to —
# an instruction, and this repository has concluded more than once that
# instructions are not mechanisms. The same
# reasoning was already applied to the env files in Guard 1 and simply never
# extended to the gate's own state.
#
# Every mention is refused, not only writes. Telling a read from a write lexically
# needs a verb list, and a verb list rots; `ls -la .claude/` shows every marker's
# state without naming one, so no diagnostic is lost. Deleting a marker is safe in
# itself (fail-closed) but is refused too, because separating that from creation is
# the same unsolved problem — ask the user if one genuinely needs clearing.
#
# Lexical, therefore defeatable by obfuscation, exactly like Guard 1 — and the
# `permissions.deny` entry alongside it covers the file-editing tools, which a Bash
# guard cannot see. Framed honestly: together these raise forging
# from "allow-listed and silent" to "requires deliberate evasion that is visible in
# the transcript". Neither is a boundary against an agent that has decided to cheat.
#
# One name, not four. `.finder-done`, `.finder-hash` and `.pair-ok` were listed
# here alongside `.review-stamp`; all three went with the second dispatch they
# paired, so refusing them would refuse nothing and would read as a
# gate wider than it is.
case "$NORM" in
  *.review-stamp*)
    deny "PreToolUse(Bash): this command names the review gate's marker file (.review-stamp). Only the gate hooks may create or consume it — a Bash command that writes it forges the commit gate. Reads are refused too because a lexical guard cannot tell them apart: use \`ls -la .claude/\` to see its state without naming it. If it genuinely needs clearing, ask the user."
    exit 0
    ;;
esac

# --- Guard 4: commit gate (parent session only) ---
# "Does this land a commit" is answered by lib-commit-shape.sh, shared with
# post-bash-stamp-consume.sh. The two used to carry separate hand-written regexes
# plus a comment asking the next editor to keep them in step; they drifted, and the
# drift was a hole (see that file's header). One definition, so they cannot.
#
# Over-matching here is still the safe failure mode — prose in a heredoc or a `-m`
# body that happens to read `git … commit` only runs the stamp check below, which
# then passes. Under-matching bypasses the gate, which is what was wrong before:
# `(git commit)`, `$(git commit)` and the backtick form all escaped it entirely.
# The source is guarded and fails closed. Unguarded, a missing helper aborted this
# script under `set -euo pipefail` with no JSON at all — and because this line runs
# for every command that gets past Guards 1–3, that was a crash on nearly every
# Bash call, not merely a disabled commit gate. Whether the harness reads a
# non-JSON, non-zero PreToolUse exit as fail-open is not something this repo can
# verify, so it is not something to depend on.
LIB="$(dirname "$0")/lib-commit-shape.sh"
if [ ! -f "$LIB" ]; then
  deny "PreToolUse(Bash): the commit-gate helper .claude/hooks/lib-commit-shape.sh is missing, so whether this command lands a commit cannot be decided. Refusing rather than risking an unreviewed commit. Restore the file."
  exit 0
fi
# shellcheck source=lib-commit-shape.sh
. "$LIB"
if ! command_lands_a_commit "$CMD"; then
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
  deny "PreToolUse(Bash): the review gate has not been stamped. Dispatch the code-reviewer agent (or run /review-diff) on the uncommitted diff before committing — its completion writes the stamp. Never create the stamp by hand and never ask the user to; a manual marker forges the gate."
  exit 0
fi

# The stamp records WHICH PATHS were reviewed, not merely THAT a review ran, so
# existing is not enough: every changed path now has to appear in it.
# lib-review-scope.sh carries why this is containment (a split and the review's own
# fixes both keep working) and the one thing it deliberately does not catch.
SCOPE_LIB="$(dirname "$0")/lib-review-scope.sh"
if [ ! -f "$SCOPE_LIB" ]; then
  deny "PreToolUse(Bash): the commit-gate helper .claude/hooks/lib-review-scope.sh is missing, so whether this commit touches only reviewed files cannot be decided. Refusing rather than risking an unreviewed commit. Restore the file."
  exit 0
fi
# shellcheck source=lib-review-scope.sh
. "$SCOPE_LIB"

if ! CURRENT_SCOPE=$(cd "$ROOT" && review_scope); then
  deny "PreToolUse(Bash): whether this commit touches only reviewed files could not be decided, so it is refused rather than risked. Causes: git could not report the current state, e.g. no commits yet on this branch; or a changed path holds a quote, backslash, or control character, which the stamp format cannot represent — rename it."
  exit 0
fi

UNREVIEWED=""
while IFS= read -r SCOPE_PATH; do
  [ -z "$SCOPE_PATH" ] && continue
  # -x -F: whole line, literal. A path is not a pattern, and a partial match would
  # let `src/a.ts` pass as reviewed because `src/a.ts.bak` was. `--` is required
  # too: a repo-root path may begin with a dash, and grep would then read the line
  # it is meant to search for as its own options.
  if ! grep -qxF -- "$SCOPE_PATH" "$ROOT/.claude/.review-stamp" 2>/dev/null; then
    UNREVIEWED="${UNREVIEWED}
  - ${SCOPE_PATH}"
  fi
done <<EOF
$CURRENT_SCOPE
EOF

if [ -n "$UNREVIEWED" ]; then
  deny "PreToolUse(Bash): these files were not in the diff the review read, so committing now would land code no reviewer saw:${UNREVIEWED}

They appeared after the review that stamped the gate. Fixes to files the review DID read are fine and keep the stamp — this is about files it never saw. Run /review-diff on the current diff; its completion re-records the scope. Never create or edit the stamp by hand."
  exit 0
fi

exit 0
