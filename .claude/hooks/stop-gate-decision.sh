# shellcheck shell=bash
# What the Stop gate says, and the three judgments behind it: which payload
# field downgraded a block, whether the changed files reach the quality gate,
# and how the failures the steps collected become one summary and one body.
# Running the steps, reading the payload off stdin, entering the tree and
# encoding the JSON stay in stop-gate.sh, which sources this file, so
# stop-gate-decision.test.ts reaches every sentence below in one bash process
# without building a scratch git repository.
#
# stop-gate.sh sets these options too, and they are here as well so the test
# driver judges under the same ones. `-e` is absent from both: a step that
# fails is collected and reported rather than ending the gate.
set -uo pipefail

# `stop_hook_active` is Claude Code's "this Stop was already blocked once"
# flag. Cursor's stop payload carries `loop_count` (auto-followups already
# triggered) instead, and it runs Claude-registered stop hooks with NO loop
# limit (loop_limit defaults to null for third-party hooks), so without this
# mapping a pre-existing failure would re-block forever there.
# `warning_message` quotes the name this prints, so a Cursor turn reads
# `loop_count` rather than a Claude field its payload never carried.
downgrade_cause() { # $1 = the Stop payload; prints "" when neither field is set
  printf '%s' "$1" | jq -j \
    'if .stop_hook_active == true then "stop_hook_active" elif (.loop_count // 0) > 0 then "loop_count" else "" end' \
    2>/dev/null || true
}

# The quality gate runs only when one of the changed paths carries one of these
# suffixes, so a docs-only turn skips typecheck, lint, format and the test
# suite. The paths arrive newline-delimited and whole, because a split on
# whitespace would truncate a filename containing a space and skip the gate for
# it. `case` reads each line where a `grep -q` would close the pipe on the
# first match: under `set -o pipefail` the SIGPIPE that kills the `printf`
# feeding it takes the pipeline to 141, which reads here as no match (measured
# on a 20001-line list, macOS, 2026-09-09).
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

# Whether a changed path is a hook or a hook's test: anything under
# `.claude/hooks/` but the rules in `guidance/`, which are documents no hook
# test reads.
holds_hook_file() { # $1 = newline-delimited paths
  local path
  while IFS= read -r path; do
    case "$path" in
      .claude/hooks/guidance/*) ;;
      .claude/hooks/*) return 0 ;;
    esac
  done <<<"$1"
  return 1
}

# Which suites the quality gate runs for the changed paths: `none`, `app`
# (`check` and `test`), or `app-and-hooks`, which adds `test:hooks`. The hooks'
# suite forks a shell per case, and on a machine whose endpoint scanning makes
# each exec cost 0.3 s it took 18 s against the 9 s of `bun run test`
# (2026-10-27), so it runs only when a hook changed. A hook reaches the gate
# whatever its suffix, which `holds_code_relevant_file` alone misses for `.sh`.
quality_gate_plan() { # $1 = newline-delimited paths
  if holds_hook_file "$1"; then
    printf 'app-and-hooks'
  elif holds_code_relevant_file "$1"; then
    printf 'app'
  else
    printf 'none'
  fi
}

# The three verdicts the markdown link check can print.
# Every sentence below reaches printf as an argument rather than as its format
# string, so a `%` someone later writes into one of them prints as itself.
link_note_clean() { printf '%s' 'md links: clean'; }
link_note_failed() { printf '%s' 'md links: FAILED'; }
link_note_skipped() { printf '%s' 'md links: SKIPPED (bun not installed)'; }

# A failure is collected instead of emitted, so the steps after it still run and
# one block names all of them.
GATE_FAILED_STEPS=""
GATE_FAILURE_OUTPUT=""

record_failure() { # $1 = step name, $2 = the step's output
  GATE_FAILED_STEPS="${GATE_FAILED_STEPS:+$GATE_FAILED_STEPS, }$1"
  GATE_FAILURE_OUTPUT="${GATE_FAILURE_OUTPUT}===== $1 =====
$2

"
}

failure_summary() {
  printf '%s' "$GATE_FAILED_STEPS failed. Fix before ending the turn."
}

failure_body() { # $1 = the link note
  printf '%s%s' "$GATE_FAILURE_OUTPUT" "$1"
}

block_message() { # $1 = summary
  printf '%s' "⛔ Stop block: $1"
}

block_reason() { # $1 = summary, $2 = reason body
  printf '%s\n\n%s' "$1" "$2"
}

# Emitted in place of a block when downgrade_cause named a field, so an
# unfixable failure does not loop.
warning_message() { # $1 = downgrade cause, $2 = summary, $3 = reason body
  printf '%s\n%s' \
    "⚠️ Stop gate STILL failing (not re-blocking — $1): $2 — if this failure is pre-existing or unfixable, report it to the user explicitly; do not treat it as passed." \
    "$3"
}

quality_gate_pass_message() { # $1 = the link note, $2 = the plan that ran: app | app-and-hooks
  case "$2" in
    app-and-hooks) printf '%s' "✅ Stop gate: typecheck / lint / format, the test suite and the hooks' test suite pass ($1)" ;;
    app) printf '%s' "✅ Stop gate: typecheck / lint / format and the test suite pass (hooks' test suite skipped: no hook changed, $1)" ;;
    *) printf '%s' "⚠️ Stop gate: the quality gate ran under an unknown plan \"$2\", so which suites passed is not known ($1)" ;;
  esac
}

quality_gate_skipped_message() { # $1 = the link note
  printf '%s' "✅ Stop gate: no code-relevant changes (quality gate skipped, $1)"
}
