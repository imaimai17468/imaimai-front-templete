#!/usr/bin/env bash
# Sourced helper (not a hook): the working-tree hash the review pairing keys on.
#
# Two hooks sample this — post-agent-review-stamp.sh when the finder FINISHES, and
# pre-agent-review-pair.sh when the verifier is DISPATCHED — and the pairing
# invariant is precisely that the two samples are equal. That window contains
# neither agent's own execution, which is what ADR-0022 settled on after two
# versions that each included one. Two copies of this function would be two chances
# for them to drift, and a drift here does not fail loudly: it silently refuses
# every commit. Hence one definition.
#
# `.claude/.review-stamp`, `.finder-done`, `.finder-hash`, `.pair-ok`,
# `.aegis-stamp`, `.aegis-unavailable` and `.session-id` are all .gitignore'd, so
# `--exclude-standard` already keeps the gate's own markers out of the hash. If a
# new marker is ever added, it MUST be added to .gitignore too, or writing it
# would change the hash it is meant to be compared against.

# Hash of exactly what a review pass sees: the tracked diff plus every untracked
# (non-ignored) file's path and content.
#
# The final hash uses `git hash-object --stdin`, not `sha256sum`: git is
# guaranteed present in a git-hook context, whereas `sha256sum` is not on stock
# macOS (which ships `shasum`). Same portability rule as the rest of the stack.
#
# THIS FUNCTION CAN RETURN NON-ZERO, AND CALLERS MUST GUARD IT. `git diff` is
# `|| true` because an empty diff is normal, but the `ls-files` stage deliberately
# is not: a failure there means the untracked-file list is incomplete, and hashing
# a partial list would silently produce a WRONG baseline — which then refuses every
# commit for the rest of the cycle, with the check looking like it worked. Under
# `pipefail` that failure propagates out of both pipelines, so a caller running
# `set -e` with a bare `CURRENT=$(review_diff_hash ...)` aborts on the spot and
# prints nothing. Both callers therefore use `if ! ...; then` and report the
# failure. Note that `ls-files ... || true` would NOT fix this: `||` binds looser
# than `|`, so `cmd || true | sort -z | while ...` runs the loop only when
# `ls-files` FAILS.
review_diff_hash() { # $1 = repository root
  local root="$1"
  {
    git -C "$root" diff HEAD 2>/dev/null || true
    git -C "$root" ls-files --others --exclude-standard -z 2>/dev/null \
      | sort -z \
      | while IFS= read -r -d '' f; do
          printf '%s\n' "$f"
          # `--` terminates options: a file literally named `--stdin` (or any
          # option-looking name) must be hashed as a path, not parsed as a flag —
          # otherwise its content changes would not move the hash.
          git -C "$root" hash-object -- "$f" 2>/dev/null || true
        done
  } | git -C "$root" hash-object --stdin
}
