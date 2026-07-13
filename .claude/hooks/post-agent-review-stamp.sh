#!/usr/bin/env bash
# PostToolUse(Agent): drive the flat review gate (ADR-0015).
#
# The review is a flat two-agent pipeline: code-reviewer (finder) then
# review-verifier (verifier). The gate must prove BOTH ran, in order, on the
# SAME diff — not merely that a verifier agent completed (ADR-0013: gates are
# deterministic artifacts, not trust in the orchestrator). So:
#
#   code-reviewer completes  -> write .finder-done containing a hash of the
#                               current diff (the diff the finder just saw).
#                               Does NOT stamp.
#   review-verifier completes -> stamp .review-stamp ONLY if .finder-done exists
#                               AND its recorded hash equals the current diff
#                               hash (i.e. a finder ran this cycle AND nothing
#                               changed between the two passes). Then consume
#                               .finder-done. Otherwise do nothing (fail-closed:
#                               no finder, or an edit slipped in between -> no
#                               stamp -> commit stays blocked).

set -euo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')

if [ "$TOOL" != "Agent" ]; then
  exit 0
fi

# Skip in subagent (sidechain) sessions.
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || true)
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  if head -1 "$TRANSCRIPT" 2>/dev/null | grep -q '"isSidechain":true'; then
    exit 0
  fi
fi

SUBTYPE=$(printf '%s' "$INPUT" | jq -r '.tool_input.subagent_type // ""')
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Hash of exactly what a review pass sees: the tracked diff plus every
# untracked (non-ignored) file's path and content. The gate markers
# (.review-stamp / .finder-done / .aegis-stamp / .aegis-unavailable) are all
# .gitignore'd, so `--exclude-standard` already keeps them out of this hash —
# no extra filtering (and no empty-input `grep` that would trip `pipefail` and
# silently abort the hook on a tracked-only diff).
#
# The final hash uses `git hash-object --stdin`, not `sha256sum`: git is
# guaranteed present in a git-hook context, whereas `sha256sum` is not on stock
# macOS (which ships `shasum`). Same portability rule as the rest of the stack.
diff_hash() {
  {
    git -C "$ROOT" diff HEAD 2>/dev/null || true
    git -C "$ROOT" ls-files --others --exclude-standard -z 2>/dev/null \
      | sort -z \
      | while IFS= read -r -d '' f; do
          printf '%s\n' "$f"
          # `--` terminates options: a file literally named `--stdin` (or any
          # option-looking name) must be hashed as a path, not parsed as a
          # flag — otherwise its content changes would not move the hash.
          git -C "$ROOT" hash-object -- "$f" 2>/dev/null || true
        done
  } | git -C "$ROOT" hash-object --stdin
}

case "$SUBTYPE" in
  code-reviewer)
    # Finder done: record the diff it reviewed. No stamp yet.
    diff_hash > "$ROOT/.claude/.finder-done"
    exit 0
    ;;
  review-verifier)
    # Verifier done: stamp only if a finder ran this cycle on this same diff.
    if [ -f "$ROOT/.claude/.finder-done" ]; then
      RECORDED=$(cat "$ROOT/.claude/.finder-done" 2>/dev/null || true)
      CURRENT=$(diff_hash)
      if [ -n "$RECORDED" ] && [ "$RECORDED" = "$CURRENT" ]; then
        touch "$ROOT/.claude/.review-stamp"
      fi
      rm -f "$ROOT/.claude/.finder-done"
    fi
    exit 0
    ;;
  *)
    exit 0
    ;;
esac
