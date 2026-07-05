---
name: verify-spec
description: Agent-based model checking of a state-machine spec — formalize → counterexample hunt → adversarial trace replay (ADR-0010/0011). Design step of start-workflow for interaction-complex features (wizards, auth/session flows, async guards, permission branching). Pass the spec path as the argument.
user_invocable: true
---

# Verify Spec

Design-time model check of a state-machine spec (ADR-0010, mechanism per ADR-0011). This skill is **preloaded into the `spec-verifier` agent** (`.claude/agents/spec-verifier.md`) — that agent is the verifier. Write the spec as a state machine, then the agent tries to break it: "戻る・リロード・二重送信・権限変更の合わせ技で壊せるか？"

Benchmarking (2026-07-04) showed the old parallel workflow (4 hunt lanes) burned ~800K tokens on overlapping counterexamples. This collapses to **1 formalizer + 1 comprehensive hunter + 1 verifier child** at ~1/3 the cost.

**Honest limit**: "found = real" but "not found ≠ safe." If the hunt fails, the result is an outage, not a clean pass (fail-closed).

## Routing — how this runs

- **Human invoked `/verify-spec <path>` (you are the parent session):** dispatch the `spec-verifier` agent with the spec path and integrate what it returns. Do NOT run the steps below in the parent context.
- **You are the `spec-verifier` agent (this skill is preloaded):** execute the procedure below directly on the spec path you were given.

## When to run

Step 4 of `start-workflow`, for features with non-obvious state transitions: wizards / multi-step forms, auth or session flows, async guards (disable-while-loading, unsaved-changes), permission branching. The deciding factor is interaction complexity, not scale. Write the spec first (format: `specs/README.md`), then run this. Fix the design for every CONFIRMED counterexample before implementing.

## Argument

The spec path, e.g. `/verify-spec specs/checkout.spec.md`. Optional search depth defaults to 8 steps.

## Procedure (executed by the spec-verifier agent)

### Step 1 — Formalize

Read the spec (format documented in `specs/README.md`) and normalize it into a structured state machine:

- every state; the initial state
- every action as a (from → to) transition with its `requires` guard and `ensures` postcondition
- every invariant, every forbidden flow, every requirement
- ambiguities: undefined/unreachable states, actions that plausibly need a guard but have none, nondeterministic transitions (same state + same action → different targets), invariants referencing undefined vocabulary, requirements with no supporting action. Report ambiguities — do NOT silently repair the spec.

Then sanity-check the machine yourself: the initial state is in `states`; every action's from/to is a known state (or `*`). Add any inconsistency as a critical ambiguity.

### Step 2 — Hunt (all lenses, one pass)

Search for counterexamples across ALL lenses at once, over legal traces of at most `depth` steps from the initial state (every step's `requires` guard must hold). Report every candidate including uncertain ones.

- **invariant**: for each invariant, construct a legal trace ending in a state where it is false
- **forbidden**: for each forbidden flow, construct a legal trace that realizes it
- **liveness**: deadlocks (non-terminal state with no enabled action), livelocks (cycles that never reach a terminal state), started flows that some user choice makes unfinishable
- **refinement**: for each requirement, find one with no supporting transition path, or a legal trace that satisfies every guard yet defeats the requirement's intent

Adversarial toolkit: back navigation, cancel, retry, page reload, double-click/double-submit, concurrent tabs, permission or session change mid-flow, network failure at any step.

Each counterexample: `{ property, trace: ["state --action--> state (why the guard held)", …], explanation, severity ("critical"|"major"|"minor") }`.

### Step 3 — Verify (dispatch a separate child — do not verify your own counterexamples)

Dispatch ONE verifier child agent (`model: sonnet`, `subagent_type: general-purpose`) with a self-contained prompt containing the machine and the full counterexample list as JSON. For each, the child replays the trace step by step and checks: (1) starts in the initial state; (2) every step's action exists and its `requires` guard holds in that step's source state; (3) the claimed violation actually holds at the end (for liveness: no enabled action escapes); (4) the trace is at most `depth` steps. Verdict CONFIRMED / PLAUSIBLE / REFUTED; REFUTED if any check fails; default to REFUTED when uncertain.

### Step 4 — Return

Drop REFUTED counterexamples. Sort survivors by verdict (CONFIRMED first) then severity. Return:

```
{ spec, depth, incomplete (true if the hunt outaged), ambiguities, counterexamples: [ { property, trace, explanation, severity, verdict, verification } ], stats: { candidates, refuted } }
```

There is NO commit-gate stamp — this is a design-time tool.

## After the verification (parent session)

1. Read the ambiguities first — an ambiguous spec is a design gap; fix the spec.
2. For every CONFIRMED counterexample, fix the design (update the spec) and re-run before implementing.
3. If `incomplete` is true, the hunt outaged — re-run; do not treat it as a clean pass.
