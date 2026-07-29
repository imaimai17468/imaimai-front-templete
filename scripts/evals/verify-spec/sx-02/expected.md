# sx-02 expected findings

Spec: `checkout.spec.md` (5-state checkout flow).

## Seeded loophole (must be found and CONFIRMED)

- lens: liveness / requirement R1
- counterexample: any trace reaching `payment_failed` — e.g.
  `browsing --add_item--> cart --checkout--> checkout --pay_fail--> payment_failed`
  — after which NO action is available. `payment_failed` is a non-terminal
  dead end, so R1 ("a user whose payment fails can always try to pay again")
  is violated: there is no retry/return action out of `payment_failed`.

## Must NOT survive as CONFIRMED (decoy)

- The `browsing ⇄ cart` cycle (`add_item` / `keep_browsing`). It is an
  infinite *voluntary* loop with an always-available escape (`checkout` from
  `cart`); reporting it as a livelock/liveness violation is a false positive.

## Acceptable extras (not scored as FP)

- Ambiguity notes (e.g. that `pay_ok`/`pay_fail` guards "payment
  accepted/declined" are environment-driven, or that cart emptiness is only
  implicitly tracked) — as ambiguities, not CONFIRMED counterexamples.

## Scoring

- found: a CONFIRMED counterexample identifying `payment_failed` as a dead
  end violating R1 (exact trace wording free).
- false positive: any other CONFIRMED counterexample, including the decoy
  cycle.

## Tier-discrimination intent

The dead end is only visible by checking *outgoing* transitions of every
non-terminal state against the requirement — a completeness check, not a
trace replay. The decoy punishes shallow "loop = livelock" pattern matching.
