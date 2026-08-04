#!/usr/bin/env bash
# SessionStart hook (ADR-0013): environment validation + session marker reset.
#
# The enforcement stack assumes tools that not every machine has (similarity-ts
# binary, python3, Aegis MCP server, plugin-provided skills). Gates that silently
# skip a missing dependency create sessions whose guarantees differ by machine
# with no signal. This hook makes the degrade visible at session start.
#
# It also clears the per-session gate markers — the aegis consultation window and
# degrade markers, and the four of the review cycle (`.review-stamp` plus the three
# the finder→verifier pairing uses) — so one session's state cannot leak into a
# different one. That clear is conditional, and the block below is both the
# mechanism and the reasoning: a SessionStart re-firing for the session already
# running keeps the markers, while a missing or unreadable `session_id` still
# clears unconditionally. The rule for membership is "every marker under .claude/
# that a hook creates", not the list down there: enumerating is how one gets
# forgotten when another is added. They are the `.claude/.*` entries in .gitignore.

set -uo pipefail

INPUT="$(cat 2>/dev/null || true)"

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Clear only when the session actually changed. A SessionStart can re-fire for a
# session that is already running — observed in this project's remote containers
# when an MCP server reconnects — and clearing then discards markers the running
# session legitimately earned. On 2026-08-03/04 that cost three complete
# find→verify passes: each stamp was created, seen on disk, and gone by the time
# the commit it authorised ran, every loss landing on a turn boundary.
#
# Fail-safe by construction: a missing `session_id`, an unreadable payload, or no
# jq all fall through to the unconditional clear this hook did before the check
# existed. A payload without the field therefore cannot make the gate more
# permissive than it already was. `session_id` is read here rather than trusted
# from documentation, per ADR-0022; `scripts/test-review-gate.py` pins both
# branches.
#
# Accepted residual risk, in the unsafe direction, stated rather than papered
# over. `pre-bash-guard.sh` authorises a commit on `.review-stamp` merely
# EXISTING, and ADR-0019 already stopped edits from clearing it, so this clear
# was the last backstop against a stamp earned in one context authorising a
# commit in an unrelated one. It was unconditional before; now `session_id`
# equality is the only discriminator. Three ways that loses. Two are unsafe: an
# id reused after the tree changed out of band (`/resume`, a restored container
# snapshot), and two concurrent sessions sharing one `.claude/` directory, where
# the second to fire reads the first's id. The third is safe and is the price of
# the clear and the record not being one atomic step — killed between them, this
# hook leaves the id unwritten and the next same-session fire clears again for
# nothing. Reordering does not fix it, it inverts it: recording first would let
# an interrupted run skip a clear it owed. Neither unsafe case is checkable from
# inside this repository —
# the payload's uniqueness and lifetime are the platform's to guarantee and no
# real payload has been captured here. Before leaning on this mechanism further,
# search the SessionStart payload documentation and settle it.
SESSION_ID=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null || true)"
fi

PREV_SESSION_ID=""
if [ -f "$ROOT/.claude/.session-id" ]; then
  PREV_SESSION_ID="$(cat "$ROOT/.claude/.session-id" 2>/dev/null || true)"
fi

if [ -n "$SESSION_ID" ] && [ "$SESSION_ID" = "$PREV_SESSION_ID" ]; then
  echo "[env-check] SessionStart re-fired for the session already running — gate markers kept."
else
  # `.session-id` is deliberately NOT in this list: it is the memory the check
  # above reads, so clearing it would make every SessionStart look like a new
  # session and restore the bug this guard exists to fix.
  rm -f \
    "$ROOT/.claude/.aegis-stamp" \
    "$ROOT/.claude/.aegis-unavailable" \
    "$ROOT/.claude/.review-stamp" \
    "$ROOT/.claude/.finder-done" \
    "$ROOT/.claude/.finder-hash" \
    "$ROOT/.claude/.pair-ok"

  if [ -n "$SESSION_ID" ]; then
    printf '%s' "$SESSION_ID" > "$ROOT/.claude/.session-id"
  else
    rm -f "$ROOT/.claude/.session-id"
    echo "[env-check] SessionStart payload carried no session_id — markers cleared unconditionally (fail-safe)."
  fi
fi

MISSING=()

command -v jq >/dev/null 2>&1 || MISSING+=("jq (ALL guard hooks parse their input with jq — the gates are effectively OFF)")
command -v bun >/dev/null 2>&1 || MISSING+=("bun (the Stop quality gate and lefthook's pre-commit/pre-push checks cannot run)")
[ -x "$HOME/.cargo/bin/similarity-ts" ] || command -v similarity-ts >/dev/null 2>&1 || MISSING+=("similarity-ts (Stop gate skips duplicate-type/function detection; install: cargo install similarity-ts)")
command -v python3 >/dev/null 2>&1 || MISSING+=("python3 (Stop gate skips the markdown dead-link check; the gate-behaviour test scripts under scripts/ cannot run either)")

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "[env-check] This session runs DEGRADED — missing gate dependencies:"
  printf '  - %s\n' "${MISSING[@]}"
  echo "[env-check] Per AGENTS.md 'Degraded environments': state the degrade to the user once, and do not treat skipped checks as passed."
else
  echo "[env-check] Gate dependencies present (jq, bun, similarity-ts, python3)."
fi

echo "[env-check] Note: MCP tools (aegis) and plugin skills (superpowers) cannot be probed from shell. If aegis_compile_context is not in your tool list, follow AGENTS.md 'Degraded environments' (.claude/.aegis-unavailable marker)."

# Model continuity (AGENTS.md, ADR-0014): surface the session model so a
# non-strongest parent is visible from turn one. SessionStart is the only
# hook event that receives `model`, and it is optional; mid-session model
# switches fire no hook at all — this check catches session start only.
MODEL=""
if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  MODEL="$(printf '%s' "$INPUT" | jq -r '.model // empty' 2>/dev/null)"
fi
if [ -n "$MODEL" ]; then
  echo "[env-check] Session model: $MODEL"
  case "$(printf '%s' "$MODEL" | tr '[:upper:]' '[:lower:]')" in
    *fable*) : ;;
    *) echo "[env-check] Parent model is not the strongest tier — AGENTS.md 'Model continuity (non-Fable parent)' applies: escalate design judgment, verify more. Mid-session model switches are NOT detectable by hooks; re-check /model if in doubt." ;;
  esac
else
  echo "[env-check] Session model not reported by the harness. If this session is not on the strongest available model, AGENTS.md 'Model continuity (non-Fable parent)' applies."
fi

exit 0
