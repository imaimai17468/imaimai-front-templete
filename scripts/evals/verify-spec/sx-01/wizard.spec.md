# Two-step confirm wizard spec (eval fixture sx-01)

A deliberately loophole-carrying spec: `confirm` has no guard against being
re-entered after the flow already reached `done`, and `back` from `done`
returns to `review`, so a user can submit twice. The pipeline must find the
double-submit forbidden-flow counterexample.

## States
- edit, review, done   (edit: filling the form; review: confirming; done: submitted)

## Initial state
edit

## Actions
| action  | from   | to     | requires | ensures              |
|---------|--------|--------|----------|----------------------|
| next    | edit   | review | true     | draft carried over   |
| back    | review | edit   | true     | draft preserved      |
| confirm | review | done   | true     | order submitted once |
| back    | done   | review | true     | (returns to review)  |

## Invariants
- An order is submitted at most once.

## Forbidden flows
- Reaching `done` more than once in a single session (double-submit).

## Requirements
- R1: The user can review before submitting.
