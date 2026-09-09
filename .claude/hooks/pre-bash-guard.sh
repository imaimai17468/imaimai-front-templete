#!/usr/bin/env bash
# PreToolUse(Bash) entry: read the payload, hand the command to guard_refusal,
# and print the refusal it returns. The three decisions behind that answer live
# in pre-bash-guard-decision.sh:
# 1. .env protection — block any command referencing the protected env files.
#    permissions.deny stops Read/Write/Edit, but allowed Bash readers (cat,
#    grep, head, tail, redirections) could walk around it.
# 2. find gate — prompt for the `find` shapes that reach past the deny list or
#    run/delete, while leaving scoped path discovery unattended.
# 3. unnamed-changes gate — refuse a `git add` (or its `git stage` synonym) or
#    a `git rm` whose operands are not explicit paths, and a `git commit` that
#    takes changes nobody named, because each of the three acts on files nobody
#    chose.

set -euo pipefail

# Emit a deny in both dialects at once: Claude Code reads the legacy
# decision/reason pair (pre-bash-guard.test.ts keys on the literal
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

# A `source` that fails would leave `guard_refusal` undefined, and the command
# substitution below would then hand an empty refusal to a command nothing
# checked. Denying instead puts that failure on the side that stops the command.
# `$0` carries the directory whenever the caller names this file by path, which
# .claude/settings.json and pre-bash-guard.test.ts both do; a bare
# `bash pre-bash-guard.sh` leaves the name in place, finds no file under it and
# takes the deny. `dirname` would fork a process on a hook that runs before
# every Bash call.
HOOK_DIR=${0%/*}
# shellcheck source=.claude/hooks/pre-bash-guard-decision.sh
if ! source "$HOOK_DIR/pre-bash-guard-decision.sh" 2>/dev/null; then
  deny "PreToolUse(Bash): the guard could not load ${HOOK_DIR}/pre-bash-guard-decision.sh, so nothing checked this command. Put that file back beside pre-bash-guard.sh, or run the hook by a path that names its directory."
  exit 0
fi

CMD=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""')
REFUSAL=$(guard_refusal "$CMD")
if [ -n "$REFUSAL" ]; then
  deny "$REFUSAL"
fi

exit 0
