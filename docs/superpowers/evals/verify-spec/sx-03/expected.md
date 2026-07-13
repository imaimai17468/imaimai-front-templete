# sx-03 expected findings

Spec: `draft-editor.spec.md` (4-state draft editor with autosave).

## Seeded loophole (must be found and CONFIRMED)

- lens: refinement / requirement R1
- counterexample: a legal trace where a dirty, un-autosaved draft is
  silently discarded — e.g.
  `viewing --open_editor--> editing` (user types; draft dirty, no autosave
  yet) `--session_timeout--> viewing`.
  Every step is legal per the actions table (`session_timeout` requires only
  "session expired" and ensures only "user signed out"), no invariant or
  forbidden flow is touched, yet R1 ("edits are always either persisted or
  presented for resolution — never silently discarded") is defeated. The gap
  is in the `ensures` column: `session_timeout` says nothing about the draft.

## Must NOT survive as CONFIRMED (decoy)

- The `autosave` self-loop on `editing`. An unbounded voluntary self-loop is
  not a livelock and violates nothing; reporting it is a false positive.
- The `conflict` state waiting on "user chose a merge" — a voluntary wait,
  not a dead end (`resolve` is available).

## Acceptable extras (not scored as FP)

- Ambiguity notes — e.g. whether `session_timeout` can also fire from
  `saving`/`conflict` (the table defines it only from `editing`), or that
  "dirty" state is tracked only informally.

## Scoring

- found: a CONFIRMED counterexample showing the timeout-discards-dirty-draft
  trace defeating R1 (exact trace wording free; must identify
  `session_timeout`'s silent discard as the mechanism).
- false positive: any other CONFIRMED counterexample, including the decoys.

## Tier-discrimination intent

Nothing is structurally wrong with the machine — all invariants and
forbidden flows hold. The defect exists only in the *relation* between a
legal trace and a prose requirement, and requires tracking un-modeled state
(draft dirtiness) across a trace. Invariant-checkers and structure-checkers
miss it; that is what makes it a tier probe.
