# Review-diff signal-to-noise tuning (#1) — targeted eval, 2026-07-12

Measures the effect of the benign-diff signal-to-noise guidance added to the
`review-diff` finder's Step 1 (suppress true-but-trivial cleanup/process/style
comments on behavior-identical diffs when no critical/major finding is
present; correctness lenses and rule violations keep full coverage-first).
Targeted run (not the full 7-fixture suite): the two false-positive probes
fx-06/fx-07, plus fx-01 as a detection non-regression spot-check. Both agents
sonnet, effort standard.

## Before → after

| fixture | metric | pre-#1 (`results/2026-07-12-flat-pipeline.md`) | post-#1 (this run) |
|---|---|---|---|
| fx-06 (clean-diff FP probe: constant extraction) | false positives | 1 (CONFIRMED minor) | **0 (REFUTED)** |
| fx-07 (multi-file: benign rename + real state bug) | expected bug | found (CONFIRMED) | found (CONFIRMED) |
| fx-07 | false positives (the rename) | 1 (CONFIRMED minor) | **0 (REFUTED)** |
| fx-01 (logic/boundary detection) | expected finding | found (CONFIRMED) | found (CONFIRMED) |

## What changed and where the effect landed

- **fx-06** (pure constant extraction, no critical/major): the finder still
  raised the "5MB strings can drift from the new constant" candidate (judging
  it actionable), but the **verifier** applied the benign-diff calibration and
  REFUTED it as true-but-trivial noise on a behavior-identical 3-line refactor
  that this diff did not worsen. FP 1 → 0.
- **fx-07** (benign rename + a real bug): the verifier CONFIRMED the
  pendingFile bug at **major** (regraded up from the fixture's `minor`
  severity-floor, which is a minimum not a cap). With a major finding present,
  the suppression rule's precondition ("no critical/major finding") does NOT
  hold, so it did not license dropping the rename on benign grounds. The
  verifier instead REFUTED the rename on the merits — a local-only variable
  rename with no shared contract, no rule governing local names, and the
  raised "naming-drift" theory not holding up. FP 1 → 0. (Had the bug stayed
  at minor, the benign-suppression path would also have applied — either way
  the rename drops; this fixture happens to exercise the merit path.)
- **fx-01**: detection unaffected (correctness lens is explicitly out of scope
  for the suppression rule) — CONFIRMED as before.

## Read

The tuning moved both measured false positives to zero without touching
detection. Notably the effect landed at the **verifier**, not the finder: the
finder still surfaces borderline cleanup/process observations (coverage-first
instinct), and the verifier — now armed with the calibration language — is
the stage that drops the true-but-trivial ones. That is a healthy division:
the finder stays high-recall, the verifier tightens precision.

Caveats:
- Only 3 of 7 fixtures run (the two FP probes + one detection spot). fx-02..05
  detection was not re-measured this round; the correctness-lens guidance is
  unchanged, so non-regression is expected but not re-proven here.
- n=1 per fixture; verifier judgment on borderline minors is somewhat
  stochastic. The result is "both known FPs now refute," not "FPs are
  impossible." Re-run the full suite before any model-tier decision (ADR-0014).
