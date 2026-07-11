---
name: verify-spec
description: Agent-based model checking of a state-machine spec — a hunter agent formalizes + hunts counterexamples, then a separate checker agent replays each against the machine (flat pipeline, ADR-0010/0015). Design step of start-workflow for interaction-complex features (wizards, auth/session flows, async guards, permission branching). Pass the spec path as the argument.
user_invocable: true
---

# Verify Spec

Design-time model check of a state-machine spec (ADR-0010; flat two-agent mechanism per ADR-0015, superseding the nested child of ADR-0011). The check runs as **two parent-dispatched agents, each a fresh context**: `spec-verifier` (hunter) formalizes the spec and hunts counterexamples; `spec-checker` replays each candidate against the machine. Both are depth-1 dispatches the parent waits on directly — no nested "agent waiting on its own child" (the fragility ADR-0015 removed from the review pipeline, applied here too). hunt ≠ verify independence holds because hunter and checker are separate fresh contexts. Write the spec as a state machine, then the agents try to break it: "戻る・リロード・二重送信・権限変更の合わせ技で壊せるか？"

Benchmarking (2026-07-04) collapsed the old parallel workflow (4 hunt lanes, ~800K tokens) to one comprehensive hunter + one checker at a fraction of the cost.

**Honest limit**: "found = real" but "not found ≠ safe." If the hunt fails, the result is an outage, not a clean pass (fail-closed).

## Routing — how this runs

- **Human invoked `/verify-spec <path>` (you are the parent session):** (1) dispatch the `spec-verifier` agent (hunter) with the spec path — it returns `{ machine, ambiguities, candidates, incomplete }`; (2) dispatch the `spec-checker` agent, passing the machine and candidates verbatim (even if zero) — it returns the verified survivors; (3) integrate. Do NOT run the steps below in the parent context — the fresh agent contexts are the point.
- **You are the `spec-verifier` agent (hunter, this skill is preloaded):** execute Formalize + Hunt (Steps 1–2) and return the machine + candidates. Do not replay, do not dispatch anything.
- **You are the `spec-checker` agent (this skill is preloaded):** execute Verify + Return (Steps 3–4) against the machine and candidates handed to you.

**Single pass — do NOT auto re-run.** One hunter + one checker dispatch runs the full procedure once. The parent MUST NOT re-run the pipeline on its own — not for CONFIRMED counterexamples, not on `incomplete`. Re-verification is always a fresh, explicit invocation the *user* decides on after reviewing the findings (see "After the verification").

## When to run

Step 4 of `start-workflow`, for features with non-obvious state transitions: wizards / multi-step forms, auth or session flows, async guards (disable-while-loading, unsaved-changes), permission branching. The deciding factor is interaction complexity, not scale. Write the spec first (format: `specs/README.md`), then run this. Fix the design for every CONFIRMED counterexample before implementing.

## Argument

The spec path, e.g. `/verify-spec specs/checkout.spec.md`. Optional search depth defaults to 8 steps.

## Procedure

### Step 1 — Formalize — `spec-verifier` (hunter)

Read the spec (format documented in `specs/README.md`) and normalize it into a structured state machine:

- every state; the initial state
- every action as a (from → to) transition with its `requires` guard and `ensures` postcondition
- every invariant, every forbidden flow, every requirement
- ambiguities: undefined/unreachable states, actions that plausibly need a guard but have none, nondeterministic transitions (same state + same action → different targets), invariants referencing undefined vocabulary, requirements with no supporting action. Report ambiguities — do NOT silently repair the spec.

Then sanity-check the machine yourself: the initial state is in `states`; every action's from/to is a known state (or `*`). Add any inconsistency as a critical ambiguity.

### Step 2 — Hunt (all lenses, one pass) — `spec-verifier` (hunter)

Search for counterexamples across ALL lenses at once, over legal traces of at most `depth` steps from the initial state (every step's `requires` guard must hold). Report every candidate including uncertain ones.

- **invariant**: for each invariant, construct a legal trace ending in a state where it is false
- **forbidden**: for each forbidden flow, construct a legal trace that realizes it
- **liveness**: deadlocks (non-terminal state with no enabled action), livelocks (cycles that never reach a terminal state), started flows that some user choice makes unfinishable
- **refinement**: for each requirement, find one with no supporting transition path, or a legal trace that satisfies every guard yet defeats the requirement's intent

Adversarial toolkit: back navigation, cancel, retry, page reload, double-click/double-submit, concurrent tabs, permission or session change mid-flow, network failure at any step.

Each counterexample: `{ property, trace: ["state --action--> state (why the guard held)", …], explanation, severity ("critical"|"major"|"minor") }`.

The hunter returns `{ machine, ambiguities, candidates, incomplete }` and stops — it does not replay or dispatch anything.

### Step 3 — Verify — `spec-checker`

You are given the hunter's machine and candidate counterexamples as JSON. Your context did not see the hunt — keep that independence. For each candidate, replay the trace step by step against the machine and check: (1) it starts in the initial state; (2) every step's action exists and its `requires` guard holds in that step's source state; (3) the claimed violation actually holds at the end (for liveness: no enabled action escapes); (4) the trace is at most `depth` steps. Verdict CONFIRMED / PLAUSIBLE / REFUTED; REFUTED if any check fails; default to REFUTED when uncertain. Never add counterexamples the hunter did not raise.

### Step 4 — Return — `spec-checker`

Drop REFUTED counterexamples. Sort survivors by verdict (CONFIRMED first) then severity. Return:

```
{ spec, depth, incomplete (true if the hunt outaged), ambiguities, counterexamples: [ { property, trace, explanation, severity, verdict, verification } ], stats: { candidates, refuted } }
```

There is NO commit-gate stamp — this is a design-time tool.

## After the verification (parent session)

The agent returns once; act on the single report — do NOT auto re-dispatch it.

1. Read the ambiguities first — an ambiguous spec is a design gap; fix the spec.
2. For every CONFIRMED counterexample, fix the design (update the spec) before implementing.
3. If `incomplete` is true, the hunt outaged — do not treat it as a clean pass; tell the user so they can decide whether to re-verify.
4. Re-verification (after fixing the design, or after an outage) is a **fresh, explicit invocation** — run it only when the user asks for another pass. Never loop automatically.
