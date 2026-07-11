# review-diff golden eval

Seeded-defect fixtures measuring the review pipeline (`code-reviewer` finder
+ `review-verifier`, ADR-0015). Each fixture is a patch file (self-declared
base) + an expected findings list. Scores and costs are recorded per run; a
model-tier change to `code-reviewer` or `review-verifier`, or a load-bearing
edit to `review-diff`, requires a run recorded here (AGENTS.md, Model
continuity). `spec-verifier` has no fixtures yet — that eval obligation is
scoped to the review pipeline until they exist (recorded debt).

## Layout

- `fx-NN/seed.patch` — unified diff that seeds the defect(s); applies to a
  clean tree with `git apply`.
- `fx-NN/expected.md` — base commit hash, the expected findings (file +
  nature), and known-acceptable extras.
- `fx-NN/prior-report.md` — only for delta-scenario fixtures: the prior full
  review report to pass in the dispatch prompt.
- `results/<date>-<label>.md` — one file per run set.

## Run protocol (parent session, clean tree required)

The eval docs must be **committed** before any run — the reviewer's target is
the whole uncommitted diff, and uncommitted `expected.md` files would hand it
the answers.

Per fixture:

1. `git apply docs/superpowers/evals/review-diff/fx-NN/seed.patch`
2. Dispatch the `code-reviewer` (finder) agent (model per its definition,
   effort standard). For delta fixtures, include `prior-report.md` verbatim
   and the delta description in the dispatch prompt. It returns candidate
   findings (no verdicts).
3. Dispatch the `review-verifier` agent with those candidates (mode/effort per
   fixture). It returns the surviving findings with CONFIRMED/PLAUSIBLE/REFUTED
   verdicts — this is what scoring runs against (ADR-0015; the two-agent flat
   pipeline). Record from BOTH agent results combined: surviving findings,
   subagent tokens, wall time.
4. `git apply -R docs/superpowers/evals/review-diff/fx-NN/seed.patch`;
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

## Fixture inventory

| id | seeds | expected core finding |
|---|---|---|
| fx-01 | logic/boundary (zod min) | empty name accepted, message contradicts |
| fx-02 | AGENTS.md type-escape (`as`) | banned assertion in ProfileForm |
| fx-03 | react.md purity (Math.random in render) | non-idempotent render in UserMenu |
| fx-04 | integrity (swallowed error) | success toast on failed update |
| fx-05 | delta scenario (zod max vs message) | limit/message contradiction; delta-scoped |
| fx-06 | clean diff (benign constant extraction) | NONE — any confirmed finding is a false positive |
| fx-07 | multi-file mixed (benign rename + state bug) | premature setPendingFile(null) discards avatar on failed upload; the rename must NOT be flagged |

## Known coverage gaps (debt)

- No large-diff fixture — delta mode's value hypothesis (savings scale with
  the unchanged portion) is unmeasured at realistic diff sizes.
- No fixtures for `spec-verifier` / `verify-spec` at all; ADR-0014 scopes
  the eval obligation to `review-diff` until they exist.
