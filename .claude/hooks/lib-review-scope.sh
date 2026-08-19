#!/usr/bin/env bash
# Sourced helper (not a hook): "which paths did the review look at?"
#
# Two hooks need the same answer and must not disagree:
#   post-agent-review-stamp.sh — records it when the review agent finishes
#   pre-bash-guard.sh          — compares against it before a commit lands
#
# One definition, for the reason lib-commit-shape.sh carries in full: two
# hand-written copies of one rule drift, and a drift here is a hole in the commit
# gate rather than a cosmetic inconsistency.
#
# SHAPE. One repo-relative path per line, sorted. Nothing else — no content hash.
#
# WHY CONTAINMENT. The gate requires every CURRENTLY changed path to appear in the
# recorded set. Three consequences, all of them the point:
#
#   - A multi-commit split off one review works: committing removes paths from
#     `git diff HEAD`, so what remains is a subset.
#   - Applying the review's own findings works. The fix touches files the reviewer
#     already read, so the set does not grow and the stamp still covers it. The
#     review stays one pass: find → verify → fix → commit.
#   - Starting new work does not. A file the review never saw is not in the set,
#     so the gate refuses until a fresh review has seen it.
#
# WHAT THIS DELIBERATELY DOES NOT CATCH. Rewriting an already-reviewed path with
# work unrelated to any finding passes, because a path set cannot tell one edit
# from another. An earlier version of this file recorded a content hash per path
# and did catch it — at the cost of also refusing the review's own fixes, since no
# check distinguishes "I applied what you returned" from "I wrote something new".
# That turned one review into a chain of them: five passes on the change that
# introduced it. The hole above is the accepted price of a review that terminates.
#
# The paths come from the same two commands the Stop gate uses, so "changed" means
# the same thing in both places: tracked modifications against HEAD, plus
# untracked files git is not ignoring. `--no-renames` lists both sides of a rename
# so neither path escapes.
#
# COST, because two hook timeouts are sized against it: two `git` invocations,
# independent of how many files changed. Measured 0.24s on this repository on
# 2026-08-19. Both callers are registered with 30s in `.claude/settings.json` —
# the writer's was 3s when it only ran `touch`, and raising it keeps the half that
# records the scope from having a tighter budget than the half that reads it.

# Prints the reviewed scope of the current uncommitted state. Must be called with
# the repository root as the working directory — the paths git prints are relative
# to it.
#
# An empty scope (a clean tree) is a success, not a failure: it prints nothing and
# returns 0. Containment then holds vacuously, which is correct — a commit that
# carries no file changes cannot carry unreviewed ones.
review_scope() {
  local diff_out ls_out diff_rc ls_rc paths path

  # `core.quotePath=false` keeps a non-ASCII path — any Japanese filename, and
  # this repository's docs are Japanese — printed as itself rather than C-quoted.
  # Both sides would quote consistently, so matching would still work, but the
  # refusal below and the deny message a user reads both need the real name.
  # Set per invocation so no repository config is touched.
  diff_out=$(git -c core.quotePath=false diff --name-only --no-renames HEAD 2>/dev/null)
  diff_rc=$?
  ls_out=$(git -c core.quotePath=false ls-files --others --exclude-standard 2>/dev/null)
  ls_rc=$?

  # Exit status, not emptiness. `git diff … HEAD` exits 0 whether or not anything
  # changed, and non-zero when it could not tell — HEAD unborn on a fresh repo or
  # a new orphan branch, where staged content is nonetheless committable and
  # `ls-files --others` cannot see it because it is tracked. An earlier version
  # wrote `|| true` on both calls, so that state produced an empty scope
  # indistinguishable from a clean tree, containment held vacuously, and any
  # commit passed. Failing here is what makes "cannot determine" different from
  # "nothing changed"; both callers refuse on a non-zero return.
  [ "$diff_rc" -eq 0 ] && [ "$ls_rc" -eq 0 ] || return 1

  paths=$(printf '%s\n%s\n' "$diff_out" "$ls_out" | sort -u)
  [ -z "$paths" ] && return 0

  # A read loop rather than `mapfile`, which bash 3.2 (still shipped by macOS)
  # does not have.
  while IFS= read -r path; do
    [ -z "$path" ] && continue

    # Even with quotePath off, git quotes a path containing a double quote, a
    # backslash, or a control character, and a path holding a newline cannot be
    # represented one-per-line at all. Refuse rather than record a line that means
    # something other than what it says: the cost is that a repository holding
    # such a file cannot commit until it is renamed, which is the safe direction.
    case "$path" in
      '"'*) return 1 ;;
    esac

    printf '%s\n' "$path"
  done <<EOF
$paths
EOF
}
