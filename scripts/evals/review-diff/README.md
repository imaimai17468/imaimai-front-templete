# review-diff golden eval

Seeded-defect fixtures measuring the review pipeline (the single `code-reviewer`
agent, ADR-0029). Each fixture is a patch file (self-declared base) + an expected
findings list. Scores and costs are recorded per run; a model-tier change to
`code-reviewer`, or a load-bearing edit to `review-diff`, requires a run recorded
here (AGENTS.md, Model continuity).

**Runs before 2026-08-07 measured two agents** (`code-reviewer` finder →
`review-verifier`, ADR-0015), so their token figures are the sum of two contexts.
They remain the comparison targets — the fixtures and the find/refute procedure
are unchanged, only the number of dispatches carrying them moved — but a
per-agent cost comparison against them is not like-for-like and the totals are
what to read. The spec pipeline has its own eval at
`scripts/evals/verify-spec/`.

## Layout

- `fx-NN/seed.patch` — unified diff that seeds the defect(s); applies to a
  clean tree with `git apply`.
- `fx-NN/expected.md` — base commit hash, the expected findings (file +
  nature), and known-acceptable extras.
- `fx-NN/prior-report.md` — was the prior report for delta-scenario fixtures.
  Retired input: ADR-0019 deleted delta mode, so nothing passes it any more.
- `results/<date>-<label>.md` — one file per run set.
- `results/<date>-<label>/fx-NN.md` — the report each fixture's agent actually
  returned, saved verbatim so the run set's narrative can be checked against its
  source. Runs before 2026-08-07 have none.

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
2. Dispatch the `code-reviewer` agent (model per its definition, effort
   standard). Every fixture runs in the one remaining mode — a full pass over the
   seeded diff — since ADR-0019 deleted delta mode. It runs all four stages in
   one context and returns the surviving findings with
   CONFIRMED/PLAUSIBLE/REFUTED verdicts — this is what scoring runs against
   (ADR-0029; one agent, stages internal) — and, per surviving finding, `fix` and
   `acceptance` (ADR-0020). `stats.candidates` and `stats.refuted` are what make
   the refute stage visible in the numbers, so record both: a run that refuted
   nothing is the failure mode the merge risks, not a clean sheet.
   Record from the agent result: surviving findings, subagent tokens,
   wall time, and for each survivor whether `fix` is concretely actionable rather
   than a restatement, whether `acceptance` is checkable, and whether a
   decision-needing finding listed credible options instead of an invented answer.
   **Save the agent's returned report verbatim** to
   `results/<date>-<label>/fx-NN.md`. Extract it from the run transcript rather
   than retyping it. Without this a results file's narrative about *how* the agent
   reasoned is the runner's own account of a transcript nobody else can open — a
   review of the 2026-08-07 run raised exactly that and could call it neither true
   nor false, which is why this step exists.
3. `git apply -R scripts/evals/review-diff/fx-NN/seed.patch`;
   verify `git status --short` is clean.

Run fixtures one at a time, never in parallel — they share source files and
there is a single review stamp.

**An eval run stamps the commit gate.** Its dispatches are real `code-reviewer`
dispatches, so the last fixture leaves a stamp behind that reviewed a seeded
fixture rather than any real work. This README used to end with a command to
delete the marker; that instruction has been unexecutable since ADR-0024, whose
Guard 3 refuses any Bash command naming it — and which says what to do instead:
**ask the user to clear it.** The next genuine `/review-diff` also clears it at
dispatch (`pre-agent-review-clear.sh`), so the exposure is a commit made between
the eval and the next review, not a permanent one. Say so when reporting the run
rather than leaving it for someone to discover.

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
  per-survivor notes step 2 asks for. There is no seeded fixture whose expected
  answer is a *fix*, so a degraded fix proposal on an otherwise correctly-found
  defect would not score as a miss.
