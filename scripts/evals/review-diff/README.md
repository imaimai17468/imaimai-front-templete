# review-diff golden eval

Seeded-defect fixtures measuring the review pipeline (`code-reviewer` finder
+ `review-verifier`, ADR-0015). Each fixture is a patch file (self-declared
base) + an expected findings list. Scores and costs are recorded per run; a
model-tier change to `code-reviewer` or `review-verifier`, or a load-bearing
edit to `review-diff`, requires a run recorded here (AGENTS.md, Model
continuity). The spec pipeline has its own eval at
`scripts/evals/verify-spec/`.

## Layout

- `fx-NN/seed.patch` — unified diff that seeds the defect(s); applies to a
  clean tree with `git apply`.
- `fx-NN/expected.md` — base commit hash, the expected findings (file +
  nature), and known-acceptable extras.
- `fx-NN/prior-report.md` — was the prior report for delta-scenario fixtures.
  Retired input: ADR-0019 deleted delta mode, so nothing passes it any more.
- `results/<date>-<label>.md` — one file per run set.

## Run protocol (parent session, clean tree required)

The eval docs must be **committed** before any run — the reviewer's target is
the whole uncommitted diff, and uncommitted `expected.md` files would hand it
the answers. Committing is necessary but not sufficient: the `expected.md`
files remain readable in the tree, so **every eval dispatch prompt must
forbid reading `scripts/evals/`** (Anthropic measured
answer-extraction contamination amplifying ~3.7× in multi-agent
configurations — https://www.anthropic.com/engineering/eval-awareness-browsecomp
— and frames eval integrity as adversarial, not a one-time setup).

Per fixture:

1. `git apply scripts/evals/review-diff/fx-NN/seed.patch`
2. Dispatch the `code-reviewer` (finder) agent (model per its definition,
   effort standard). Every fixture runs in the one remaining mode — a full pass
   over the seeded diff — since ADR-0019 deleted delta mode. It returns candidate
   findings (no verdicts).
3. Dispatch the `review-verifier` agent with those candidates (effort per
   fixture). It returns the surviving findings with CONFIRMED/PLAUSIBLE/REFUTED
   verdicts — this is what scoring runs against (ADR-0015; the two-agent flat
   pipeline) — and, per surviving finding, `fix` and `acceptance` (ADR-0020).
   Record from BOTH agent results combined: surviving findings, subagent tokens,
   wall time, and for each survivor whether `fix` is concretely actionable rather
   than a restatement, whether `acceptance` is checkable, and whether a
   decision-needing finding listed credible options instead of an invented answer.
4. `git apply -R scripts/evals/review-diff/fx-NN/seed.patch`;
   verify `git status --short` is clean.

Run fixtures one at a time, never in parallel — they share source files and
there is a single review stamp.

After all fixtures: `rm -f .claude/.review-stamp .claude/.finder-done` (an eval
run must never satisfy the commit gate for real work).

## Scoring

- **found** — an expected finding is reported (same file, same defect nature;
  wording free).
- **missed** — an expected finding absent from the surviving findings.
- **false positive** — a surviving CONFIRMED finding not in expected.md and
  not listed as acceptable-extra.
- Staleness: if `seed.patch` no longer applies, regenerate or retire the
  fixture in the same run and note it in the results file.
- **Close calls need repeated runs.** Environment/config variance alone can
  exceed small deltas (Anthropic measured ~6 points of agentic-benchmark
  variance from infrastructure config alone and advises distrusting small
  single-run differences —
  https://www.anthropic.com/engineering/infrastructure-noise). A single-run
  result is decisive only when the delta is large and unanimous across
  fixtures — e.g. a clean detection sweep vs. a miss, or a decision where
  cost and quality point the same way. For narrow margins (one FP apart,
  small token differences), re-run the affected fixtures across separate
  sessions before acting.
- **Grow the suite from real failures**: when the pipeline misses a real bug
  or confirms a real false positive in production use, turn that case into a
  fixture. Anthropic's eval guidance treats 20-50 tasks drawn from real
  failures as a solid starting point
  (https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents);
  this suite is below that and compensates with large-delta decisions only.

## Fixture inventory

| id | seeds | expected core finding |
|---|---|---|
| fx-01 | logic/boundary (zod min) | empty name accepted, message contradicts |
| fx-02 | AGENTS.md type-escape (`as`) | banned assertion in ProfileForm |
| fx-03 | react.md purity (Math.random in render) | non-idempotent render in UserMenu |
| fx-04 | integrity (swallowed error) | success toast on failed update |
| fx-05 | ~~delta scenario~~ (zod max vs message) | limit/message contradiction. **Delta framing retired** — ADR-0019 deleted delta mode; the seed still works as an ordinary full-mode detection fixture |
| fx-06 | clean diff (benign constant extraction) | NONE — any confirmed finding is a false positive |
| fx-07 | multi-file mixed (benign rename + state bug) | premature setPendingFile(null) discards avatar on failed upload; the rename must NOT be flagged |
| fx-08 | large mixed diff, 8 files (6 benign + swallowed-error + inverted size check) | both defects found, zero FPs on the benign majority. Its `delta.patch` half is **retired** — ADR-0019 deleted delta mode; run the full half only |

## Known coverage gaps (debt)

- The delta halves of fx-05 and fx-08 are retired rather than regenerated
  (ADR-0019 deleted delta mode). Their seeds still run as full-mode fixtures; the
  `prior-report.md` / `delta.patch` inputs and the delta measurements in
  `results/2026-07-10-delta-mode.md` and `results/2026-07-12-fx08-large-diff.md`
  are kept as the record of what delta mode bought.
- Nothing yet measures `fix` / `acceptance` quality (ADR-0020) beyond the
  per-survivor notes step 3 asks for. There is no seeded fixture whose expected
  answer is a *fix*, so a degraded fix proposal on an otherwise correctly-found
  defect would not score as a miss.
