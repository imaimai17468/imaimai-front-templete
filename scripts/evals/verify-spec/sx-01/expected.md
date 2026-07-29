# sx-01 — expected counterexample

## Expected (must be found, CONFIRMED)
- property: forbidden-flow (double-submit) / invariant "submitted at most once"
  loophole: `confirm` (review → done) has `requires: true`, and `back`
  (done → review) lets the user return to `review` after submitting, from
  which `confirm` fires again — so `done` (order submitted) is reached twice.
  A representative trace: edit --next--> review --confirm--> done
  --back--> review --confirm--> done  (second submit).
  severity-floor: major

## Acceptable extras
- An ambiguity report that `confirm` needs a guard (e.g. `requires: not already
  submitted`) — this is the same root cause surfaced as a formalize ambiguity,
  not a separate false positive.

## Notes
- The fix (not required by the eval, just for reference) is to guard `confirm`
  (`requires: not submitted`) or remove the `back` transition out of `done`.
