# Specs — lightweight state-machine specifications

Machine-checkable-by-agents specifications for interaction-complex features,
verified by the `verify-spec` dynamic workflow (ADR-0010). The discipline is
borrowed from [FSL](https://ymm-oss.github.io/fsl/): model the feature as a
finite state machine and hunt for counterexample traces **before implementing**.

Verification here is agent-based adversarial search — good at finding loophole
flows that example-based thinking misses, but **not** an exhaustive proof. If a
future project needs real model checking, these specs translate naturally to
FSL's `.fsl` format and the `fslc` verifier.

## When to write one

The deciding factor is **interaction complexity, not scale** — even 3 states
hide loopholes once back, cancel, retry, reload, double-submit, or permission
branching get involved. Write a spec for: wizards / multi-step forms, auth and
session flows, async guards (disable-while-loading, unsaved changes), approval
and permission flows, retry/queue behavior. Skip for static screens and plain
CRUD.

## Workflow

1. During start-workflow step 4 (Plan), write `specs/<feature>.spec.md` in the
   format below.
2. Verify via `/verify-spec specs/<feature>.spec.md` (optional `depth`, default
   8 steps). This is a flat two-agent pipeline (ADR-0015): the `spec-verifier`
   agent (hunter) formalizes the spec and returns candidate counterexamples,
   then the `spec-checker` agent replays each against the machine and returns
   the CONFIRMED survivors.
3. Treat every reported ambiguity as a spec bug; fix the design for every
   CONFIRMED counterexample. The pipeline runs a single pass — re-verification
   is a fresh, explicit invocation you make after fixing, never an automatic
   loop.
4. Implement. Tests still follow the white-box policy — reuse the spec's
   invariants and forbidden flows as test cases.
5. Update the spec when behavior changes. A stale spec is worse than none.

## Format: `<feature>.spec.md`

```markdown
# <Feature> spec

## States
- idle, submitting, succeeded, failed   (one per line, with a short meaning)

## Initial state
idle

## Actions
| action  | from       | to         | requires            | ensures            |
|---------|------------|------------|---------------------|--------------------|
| submit  | idle       | submitting | form is valid       | request sent once  |
| succeed | submitting | succeeded  | response ok         | result persisted   |
| fail    | submitting | failed     | response error      | error shown        |
| retry   | failed     | submitting | true                | request sent once  |

## Invariants
- At most one in-flight request exists at any time.

## Forbidden flows
- A second submit while submitting (double-submit).
- Reaching succeeded without passing through submitting.

## Requirements
- R1: The user can always recover from failed (retry or leave).
```

Conventions: `requires: true` means unguarded (the verifier treats unguarded
actions on shared triggers as suspicious); name UI events honestly (back,
reload, and cancel are actions too — leaving them out is how loopholes hide);
keep one spec per feature, small enough that every state fits in one screen.
