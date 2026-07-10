# review-diff golden eval

Seeded-defect fixtures measuring the `code-reviewer` agent (find + verify
pipeline). Each fixture is a patch file (self-declared base) + an expected
findings list. Scores and costs are recorded per run; model-tier changes to
`.claude/agents/*.md` require a run recorded here (AGENTS.md, Model
continuity).

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
2. Dispatch the `code-reviewer` agent (model per its definition, effort
   standard). For delta fixtures, include `prior-report.md` verbatim and the
   delta description in the dispatch prompt.
3. Record from the agent result: findings, subagent tokens, wall time.
4. `git apply -R docs/superpowers/evals/review-diff/fx-NN/seed.patch`;
   verify `git status --short` is clean.

Run fixtures one at a time, never in parallel — they share source files and
there is a single review stamp.

After all fixtures: `rm -f .claude/.review-stamp` (an eval run must never
satisfy the commit gate for real work).

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
