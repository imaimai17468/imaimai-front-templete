# Delta-mode verification — code-reviewer (sonnet), 2026-07-10

Run after the delta-mode skill change (commit 80f60be), compared against
`2026-07-10-baseline-sonnet.md`. Protocol per `../README.md`.

## Quality non-regression (full-mode re-runs)

| fixture | baseline | re-run | tokens (base → now) | wall time (base → now) |
|---|---|---|---|---|
| fx-01 | found | **found** | 34,755 → 37,438 | 57s → 97s |
| fx-02 | found | **found** | 41,842 → 54,526 | 144s → 210s |
| fx-03 | found | **found** | 40,478 → 39,704 | 59s → 87s |
| fx-04 | found | **found** | 38,149 → 40,883 | 74s → 108s |

4/4 found, 0 missed, 0 false positives — no quality regression. All reports
now include the new `mode` field ("full"). Wall time rose near-uniformly
(+46–70%) across all four fixtures: the likely driver is the foreground-wait
mandate for the verifier child, added by the same commit under test
(80f60be) — before it, a reviewer could return before its backgrounded
child finished; after it, every run includes the full child wait. Treat the
re-run column, not the baseline, as the cost reference for future
comparisons (causality untested — token deltas stayed small, consistent
with waiting rather than extra work; fx-02's larger token delta is its
verifier running tsc twice via stash round-trip). The fixture set stays
saturated.

## Delta-mode measurement (fx-05)

| run | mode | found | tokens | wall time | tool uses |
|---|---|---|---|---|---|
| baseline (full) | full | 1/1 | 43,035 | 96s | 13 |
| **delta** (prior report + delta description) | delta | 1/1 | **37,632** | **78s** | **5** |

- Delta run: −13% tokens, −19% wall time, −62% tool uses vs the full
  baseline on the same seeded defect. No whole-project verification commands
  were re-run (the delta prohibition held; the baseline run had executed
  vitest). Finding quality unchanged (CONFIRMED, correct file/line/nature).
- Honest caveat: this fixture's diff is one hunk, so full mode is already
  cheap — the absolute saving here is small. Delta mode's payoff scales with
  the size of the *unchanged* portion of a real diff, which this fixture set
  does not measure. The observed win on even the smallest diff plus the
  observed real-world delta re-reviews earlier the same day (~60–65k tokens
  on multi-file doc diffs, vs ~95–105k for comparable full re-reviews) are
  the current evidence base.

## Fallback check

Delta dispatch WITHOUT the prior report: the agent explicitly stated the
fallback ("Fell back to full review... the skill requires failing closed to
full mode when the prior report is missing"), ran full mode, and still found
the seeded defect (vitest-verified). Fail-closed behavior works as specified.

## Commit-gate probe

- `rm .claude/.review-stamp` then `git commit --allow-empty` in a **separate**
  Bash call: **blocked** by the PreToolUse gate hook with the ADR-0013
  message. Gate healthy.
- Caveat discovered: when the stamp deletion and the commit are combined in a
  **single** Bash invocation, the PreToolUse hook evaluates while the stamp
  still exists and the commit passes. This is inherent to hook-evaluation
  timing, low practical risk (requires deliberately constructing the bypass),
  recorded here for awareness.

## Verdict (spec Phase 2 acceptance)

- Delta re-review passes the eval with no quality regression and measurably
  lower cost: **pass** (4/4 with 0 FP on full re-runs; −13% tokens / −19%
  time / −62% tool uses on the delta fixture; larger savings expected on
  larger diffs). Fallback fail-closed behavior also verified (skill-level
  property, beyond the spec's minimum).
- AGENTS.md section exists: **pass** ("Model continuity (non-Fable
  parent)", added in commit 80f60be).
- Commit gate behavior unchanged: **pass** (probe blocked; with the
  single-invocation caveat noted above).

## Incidental findings from today's real-world delta usage

- Two real (non-eval) reviews initially backgrounded their verifier child and
  ended their turn, making verdicts unretrievable until nudged; the skill now
  mandates foreground waiting (commit 80f60be). Post-mandate runs completed
  their children in-turn.
