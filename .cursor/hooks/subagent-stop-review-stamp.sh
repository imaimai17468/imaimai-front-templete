#!/usr/bin/env bash
# subagentStop adapter for Cursor's native project-hook loader (.cursor/hooks.json).
#
# WHY THIS EXISTS (observed in a Cursor Cloud Agent VM, 2026-08-07). The
# registration in .claude/settings.json reaches this repository's PreToolUse
# guards in cloud sessions — pre-bash-guard.sh blocked live commands there —
# but three code-reviewer completions in the same session (two waited-on, one
# background) delivered no SubagentStop payload, so the commit gate could not
# be stamped at all. Cursor's hooks documentation lists subagentStop as
# supported for cloud agents via project hooks in .cursor/hooks.json
# (https://cursor.com/docs/hooks, "Cloud agent support"), which is the
# registration that invokes this file.
#
# WHAT IT DOES. The documented native subagentStop payload carries no
# hook_event_name field, and post-agent-review-stamp.sh refuses a payload
# without one so that a mis-registration under a different event can never
# stamp. This script runs only under the subagentStop entry in
# .cursor/hooks.json, so adding that event name states how the payload
# arrived; nothing else is changed, and every stamping decision (status,
# blank-report classification) stays in the gate script it delegates to.
# pipefail is intentionally omitted, unlike this repo's other hook scripts:
# the delegate below always runs and exits 0 once it decides, and with
# pipefail an earlier stage's failure (jq absent, malformed stdin) became
# this script's own exit status instead — reproduced exits 127 and 5 while
# the delegate had already printed its fail-closed refusal.
set -eu

INPUT=$(cat)
printf '%s' "$INPUT" \
  | jq -c 'if has("hook_event_name") then . else . + {hook_event_name: "subagentStop"} end' \
  | "$(dirname "$0")/../../.claude/hooks/post-agent-review-stamp.sh"
