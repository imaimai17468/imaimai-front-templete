# 0020. The verifier returns the fix, not just the finding

- Status: accepted
- Date: 2026-07-28

## Context

[ADR-0019](0019-single-pass-review.md) made the review one pass — find → verify →
fix → done — and recorded what that costs: "the fix itself is no longer judged by
a fresh context." The shape of the pipeline made the gap precise. The finder finds,
the verifier refutes, and then **the parent invents the remedy**, which nothing
downstream examines. The Stop gate, lefthook, CI and the PR-side reviewer all
check mechanics; none of them asks whether the change addresses the finding.

That gap is not theoretical. The 2026-07-25 audit's S0 entry records a first fix
that passed a secret explicitly but left the absent case silent — correct-looking,
incomplete, and caught only by the re-review ADR-0019 removed.

The repository owner named the move while ADR-0019 was still being written: if the
pass happens once, invest in making that one pass right. The cheapest place to
invest is the step that currently has no reviewer.

## Decision

For every finding it does not refute, the verifier also returns:

- **`fix`** — the concrete change: which file, what it should say instead, and why
  that shape rather than the alternative considered. A restatement of the problem
  does not qualify.
- **`acceptance`** — how the parent confirms the fix landed, checkable without
  re-running the review: a command, or a specific observable in the code.

The parent applies those and commits. Departing from a returned fix is allowed —
the parent can see things the verifier could not — but it must say so and why.

**Findings that need a decision are exempt, explicitly.** Where a remedy turns on
an ADR-level choice or a genuine trade-off, the verifier writes that in `fix`
along with the credible options instead of inventing one, and the parent asks the
user. Forcing a fix into every field would manufacture confident answers to
questions that belong to the owner — the opposite of the goal.

This does not reintroduce a return arrow. Nothing re-runs; the judgement moves
*into* the pass rather than after it.

## Alternatives considered

- **Re-run the verifier on the fix**: rejected in ADR-0019 and still rejected —
  it is the loop the owner objected to, in a smaller costume.
- **Treat the finder's proposed fix as final, unjudged**: rejected. The finder
  already sketches a fix per Step 1 — written before verification, for candidates
  that may not survive it — so treating that sketch as final would let an
  unverified remedy land. The verifier's `fix`, written only for survivors, after
  refutation, with the code loaded, supersedes it. (Removing the finder's
  obligation was not an option either: AGENTS.md requires findings to propose a
  concrete alternative.)
- **Have the parent write the fix and a separate agent judge it**: rejected — a
  third dispatch per review, for a judgement the verifier is already positioned
  to make while it has the code loaded.
- **Leave it to the parent and rely on the PR-side reviewer**: rejected. That
  reviewer sees the final diff without the finding that motivated it, so it cannot
  tell a complete fix from a plausible one.

## Consequences

- The verifier does more per finding, so its cost rises with the number of
  survivors. On a clean diff nothing changes: no survivors, no fixes.
- The first verifier to run under this contract hit a gap in it while following
  it: the decision-exemption path said what `fix` should hold but not
  `acceptance`, so it had to invent a convention. That is the kind of defect a
  contract only reveals in use, and it is why the contract was exercised on its
  own diff before being committed.
- **The risk is attention, not correctness.** A verifier asked to design remedies
  may refute less rigorously — the failure would show up as false positives
  surviving, or as expected findings missed. That is exactly what the golden evals
  measure, which is why this change is gated on a scored run rather than argued.
- The parent's latitude is narrowed on purpose: it applies a judged fix instead of
  authoring an unjudged one. The escape hatch is disclosure, not silence.
- `mode` / `fallback` were already gone from the return contract (ADR-0019); this
  adds `fix` and `acceptance` to it. Consumers of the report are the parent and
  the human reading it, so the shape can change without a migration.
- Under [ADR-0014](0014-measurement-first-model-continuity.md) this is a
  load-bearing edit to `review-diff` that changes how the verifier behaves, so it
  requires a scored eval run recorded in `docs/superpowers/evals/review-diff/results/`
  before this ADR can claim the risk is measured. **That run is pending as this ADR
  is committed** — the run and its results file follow in the same change, and the
  agreed scope is partial (four fixtures rather than eight), with the reason
  recorded in the results file.
