# Flat pipeline (ADR-0015) — code-reviewer finder + review-verifier, effort standard, 2026-07-12

First scored run of the flat two-agent pipeline, and the first run ever for
the fx-06 (false-positive probe) and fx-07 (discrimination probe) fixtures.
Protocol per `../README.md` (finder dispatch → verifier dispatch with the
candidates → score off the verifier's surviving findings). Runner: parent
session (Fable); both agents sonnet. 14 dispatches total, **zero hangs**
(the nested design stalled 3 times in the prior session — the reliability
claim of ADR-0015 is the headline result).

## Detection (fx-01…fx-05, comparable to the nested baseline)

| fixture | found | FP | tokens (finder+verifier) | wall time |
|---|---|---|---|---|
| fx-01 (logic/boundary) | 1/1 CONFIRMED | 0 | 59.0k | 69s |
| fx-02 (type escape) | 1/1 CONFIRMED | 0 | 79.5k | 546s* |
| fx-03 (render purity) | 1/1 CONFIRMED | 0 | 69.3k | 78s |
| fx-04 (swallowed error) | 1/1 CONFIRMED | 0 | 74.2k | 73s |
| fx-05 (max vs message) | 1/1 CONFIRMED | 0 | 59.5k | 91s |

\* fx-02's verifier reproduced the no-cast typecheck by editing/restoring the
file and running tsc twice — thorough but slow; an outlier.

All five verdicts CONFIRMED with correct rule citations (AGENTS.md
type-escape, react.md Idempotent, design.md Content States) and correct
dedup discipline (fx-04's two same-line candidates merged by the verifier).
**Detection quality is unchanged vs the nested baseline (5/5 → 5/5).**

## New probes (first measurements)

| fixture | expected | result | tokens | wall time |
|---|---|---|---|---|
| fx-06 (clean diff, FP probe) | 0 findings | **FP = 1** (CONFIRMED minor: "constant doesn't replace the duplicated '5MB' display strings") | 70.3k | 49s |
| fx-07 (multi-file mixed) | 1 finding; rename NOT flagged | found 1/1 CONFIRMED (pendingFile bug) but **FP = 1** on the rename (CONFIRMED minor, commit-split framing) | 76.9k | 113s |

Honest read of the 2 FPs: both are *factually true observations* (the
display strings really are unlinked; the rename really is an unrelated
drive-by that AGENTS.md's commit rule says to split). The fixtures' strict
rubric counts them as over-reporting because a benign refactor should draw
zero findings. This quantifies a real tendency — the cleanup/process lenses
comment on benign changes — and gives any future tuning a target: **FP rate
2/7 fixtures, both minor**. Precision scoping, stated precisely: neither FP
claims a bug or violation that does not exist in the code — both are
true-but-out-of-scope observations on benign changes, which the rubric
counts as FPs. No finding with a fabricated failure scenario survived
verification; only in that narrow sense (defect claims, not the rubric's FP
count) is verifier precision 100%.

## Cost vs the nested baseline

| metric | nested (2026-07-10 baseline, fx-01..05) | flat (this run, fx-01..05) |
|---|---|---|
| tokens | 198.3k (avg 39.7k/fixture) | 341.5k (avg 68.3k/fixture) |
| wall time | 430s† | 857s (311s excluding the fx-02 outlier) |
| hangs/stalls | 0 in that run; **3 across the session** | **0 in 14 dispatches** |

† pre-foreground-mandate numbers, known to undercount (see
`2026-07-10-delta-mode.md`).

The flat pipeline costs ~70% more tokens per review: two full agent contexts
each read the diff/rules instead of one context plus a child. That is the
price of the reliability fix, paid in cheap sonnet tokens. Given the nested
design's three incidents in a single day (two lost-verdict failures and one
review stuck ~40 minutes before being killed — ADR-0015 Context), each
costing more than the entire token delta, the trade is clearly favorable at
current diff sizes.

## Verdicts

- **Quality non-regression (ADR-0014 eval governance, applied to the
  ADR-0015 pipeline change): pass** — 6/6 expected findings found, all
  CONFIRMED, rules cited, dedup applied.
- **ADR-0014 obligation for the ADR-0015 pipeline change: satisfied** by
  this scored run.
- **New capability:** FP rate is now measurable (was structurally impossible
  before fx-06/07 existed). Current: 2 minor FPs / 7 fixtures.
- **Open question (do not tune without another eval round):** whether to
  instruct the finder to suppress minor cleanup/process comments on
  behavior-identical diffs. Both FPs were true statements — suppressing
  them trades reviewer helpfulness for rubric purity. Decide deliberately.
