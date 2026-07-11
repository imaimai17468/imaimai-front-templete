# 0015. The pre-commit review is a flat finder → verifier pipeline (verifier unnested)

- Status: accepted
- Date: 2026-07-10

## Context

ADR-0011 made the pre-commit review a single dispatched `code-reviewer` agent
that (a) finds candidates and (b) dispatches a nested verifier child to
refute them, with the gate keyed to the `code-reviewer` agent's completion.
The find ≠ verify independence (a fresh, finding-blind context refutes) was
the load-bearing property, and it repeatedly earned its keep: across this
project's review history the verifier refuted ~25–30% of candidates,
including finder claims traced back to design docs and the parent's own
mis-labelled measurements.

But the *implementation* — a nested child at depth 2 — has one fragile joint:
the middle agent (`code-reviewer`) must wait on its own sub-agent across an
async boundary. On 2026-07-10 this failed twice: the middle agent ended its
turn while the child ran, and the child's verdicts became unretrievable. A
band-aid (verdict written to a transport file + a foreground-wait mandate)
was added, and then failed a third time — a review sat stuck ~40 minutes
waiting on a child that never reported, producing no verdicts and no gate
stamp. The fragility is structural: "an agent waiting on its own child" is
exactly the link the harness does not make reliable, whereas a parent waiting
on a depth-1 dispatch has been 100% reliable in the same session.

## Decision

Unnest the verifier. The review is a **flat two-agent pipeline the parent
orchestrates**, both agents depth-1:

1. **`code-reviewer`** (finder) — reads the diff, returns candidate findings
   as JSON. It does not verify, does not dispatch anything, does not stamp.
   Its `Agent` tool is removed (least privilege).
2. **`review-verifier`** (new agent) — receives the candidate JSON, refutes
   each by reading the real code in a context that never saw the find pass,
   returns survivors. **Its completion stamps the commit gate.**

The parent dispatches finder then verifier in sequence, passing the candidate
list between them, and waits on each directly. The gate hooks move
accordingly:

- `pre-agent-review-clear.sh`: on `code-reviewer` dispatch (cycle start) clears
  both `.review-stamp` and the finder marker `.finder-done`.
- `post-agent-review-stamp.sh`: on `code-reviewer` completion writes
  `.finder-done` containing a hash of the diff the finder saw; on
  `review-verifier` completion stamps `.review-stamp` **only if** `.finder-done`
  exists AND its hash equals the current diff hash, then consumes it.
- `pre-agent-aegis-guard.sh`: `review-verifier` added to the exempt list.

The diff-hash marker is what keeps the gate deterministic (ADR-0013) after
unnesting: the stamp proves a finder ran this cycle AND the verifier saw the
same diff (no edit between the two passes). Dispatching `review-verifier` alone,
or editing files mid-window, cannot produce a stamp.

find ≠ verify independence is preserved — finder and verifier are still
separate fresh contexts, and the parent (which is not blind) only routes the
structured candidate list; it does no finding or verifying itself. The
`review-diff` skill remains the single pinned procedure, preloaded into both
agents. Supersedes ADR-0011's *mechanism* (nested orchestrator); its
find→verify discipline, commit-gate contract, and fail-closed guarantees are
unchanged. The band-aid transport file added earlier the same day is removed
from `review-diff` (the flat pipeline makes it unnecessary).

`spec-verifier` / `verify-spec` keep the nested design for now — it is
design-time, ungated, and user-watched, so the same fragility is lower-stakes.
Its transport-file band-aid stays. Flattening it is recorded debt.

## Alternatives considered

- **Keep nesting + rely on the transport-file band-aid**: rejected — it
  failed a third time (the 40-minute stuck review). The band-aid addresses
  verdict *loss* but not the middle agent *hanging* on its child.
- **Fold find and verify into one agent (self-verify)**: rejected — destroys
  the independence that empirically refutes ~25–30% of candidates.
- **Fold both into the parent session (parent finds and verifies inline)**:
  rejected for the ADR-0011 reason — the parent is not implementation-blind;
  the bias check requires fresh contexts. Parent *orchestration* of two fresh
  agents is different and acceptable.

## Consequences

- The fragile depth-2 wait is gone; both dispatches are depth-1 the parent
  waits on directly.
- Unnesting made `review-verifier` an independently-dispatchable named agent,
  which would have let a verifier completion stamp the gate without a finder
  having run (and left mid-window edits invisible). The `.finder-done`
  diff-hash marker closes both: the stamp is provably downstream of a finder
  pass on the current diff. This restores the ADR-0011 property that a stamp
  cannot exist without a completed find pass.
- The parent's context now holds the candidate list and the verdicts (a few
  KB) — the cost ADR-0011 avoided by nesting. Negligible at this project's
  diff sizes; revisit if reviews of very large diffs make it material.
- Two agents per review instead of one-plus-child — same agent count, flatter
  shape.
- A model-tier change to `code-reviewer` or `review-verifier`, or a
  load-bearing edit to `review-diff`, requires a scored eval run
  (`docs/superpowers/evals/review-diff/`, ADR-0014). This change itself is
  validated that way.
- Debt: `spec-verifier` still nests; flatten it the same way if its child-wait
  fragility bites.
