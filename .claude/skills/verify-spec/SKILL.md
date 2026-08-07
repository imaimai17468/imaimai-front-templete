---
name: verify-spec
description: Agent-based model checking of a state-machine spec — one agent formalizes, hunts counterexamples, replays each against the machine, and returns the survivors (ADR-0010/0029). Design step of start-workflow for interaction-complex features (wizards, auth/session flows, async guards, permission branching). Pass the spec path as the argument.
user_invocable: true
---

# Verify Spec

Design-time model check of a state-machine spec (ADR-0010; single-agent mechanism per ADR-0029, superseding the two-agent pipeline of ADR-0015). The check runs as **one parent-dispatched agent, `spec-verifier`, executing four ordered stages in one fresh context**: formalize the spec, hunt counterexamples, replay each candidate against the machine, return the survivors. Write the spec as a state machine, then the agent tries to break it: "戻る・リロード・二重送信・権限変更の合わせ技で壊せるか？"

Benchmarking (2026-07-04) collapsed the old parallel workflow (4 hunt lanes, ~800K tokens) to one comprehensive hunter + one checker; ADR-0029 then merged those two into one agent, because the second dispatch's independence was not what made the pipeline expensive.

**hunt ≠ replay is now a discipline, not a mechanism.** Stage C shares a context with Stage B and can see the reasoning that produced each candidate. ADR-0029 records that downgrade as its accepted risk; the counterweight is that every verdict must cite the machine row, guard or check number it turned on, so a confirmation that never re-derived the trace is visible in the output.

**Honest limit**: "found = real" but "not found ≠ safe." If the hunt fails, the result is an outage, not a clean pass (fail-closed).

## Routing — how this runs

- **Human invoked `/verify-spec <path>` (you are the parent session):** dispatch the `spec-verifier` agent with the spec path and `run_in_background: false`, wait for it, and integrate the report it returns. Do NOT run the stages below in the parent context — the fresh agent context is the point.
- **You are the `spec-verifier` agent (this skill is preloaded):** execute all four stages below in order and return the report. Do not dispatch anything.

**Single pass — do NOT auto re-run.** One dispatch runs the full procedure once. The parent MUST NOT re-run it on its own — not for CONFIRMED counterexamples, not on `incomplete`. Re-verification is always a fresh, explicit invocation the *user* decides on after reviewing the findings (see "After the verification").

## When to run

Step 4 of `start-workflow`, for features with non-obvious state transitions: wizards / multi-step forms, auth or session flows, async guards (disable-while-loading, unsaved-changes), permission branching. The deciding factor is interaction complexity, not scale — even three states hide loopholes once back, cancel, retry, reload, double-submit or permission branching are involved. Skip static screens and plain CRUD. Write the spec first (see **Format** below), then run this. Fix the design for every CONFIRMED counterexample before implementing.

## Format

A spec is one Markdown file per feature, small enough that every state fits on a screen:

```markdown
# <Feature> spec

## States
- idle, submitting, succeeded, failed   (one per line, with a short meaning)

## Initial state
idle

## Actions
| action  | from       | to         | requires       | ensures           |
|---------|------------|------------|----------------|-------------------|
| submit  | idle       | submitting | form is valid  | request sent once |
| succeed | submitting | succeeded  | response ok    | result persisted  |
| fail    | submitting | failed     | response error | error shown       |
| retry   | failed     | submitting | true           | request sent once |

## Invariants
- At most one in-flight request exists at any time.

## Forbidden flows
- A second submit while submitting (double-submit).
- Reaching succeeded without passing through submitting.

## Requirements
- R1: The user can always recover from failed (retry or leave).
```

`requires: true` means unguarded, and this pipeline treats unguarded actions on a shared trigger as suspicious. Name UI events honestly — back, reload and cancel are actions too, and leaving them out is how loopholes hide. Update the spec when behaviour changes; a stale spec is worse than none. Worked examples live in `scripts/evals/verify-spec/sx-01..03/`.

## Argument

The spec path, e.g. `/verify-spec specs/checkout.spec.md`. Optional search depth defaults to 8 steps.

## Procedure

The four stages run in one context, in order. Their standards differ — Stage B is coverage-first, Stage C is adversarial — so do not blend them.

### Stage A — Formalize

Read the spec (format under "Format" above) and normalize it into a structured state machine:

- every state; the initial state
- every action as a (from → to) transition with its `requires` guard and `ensures` postcondition
- every invariant, every forbidden flow, every requirement
- ambiguities: undefined/unreachable states, actions that plausibly need a guard but have none, nondeterministic transitions (same state + same action → different targets), invariants referencing undefined vocabulary, requirements with no supporting action. Report ambiguities — do NOT silently repair the spec.

Then sanity-check the machine yourself: the initial state is in `states`; every action's from/to is a known state (or `*`). Add any inconsistency as a critical ambiguity.

### Stage B — Hunt (all lenses, one pass)

Search for counterexamples across ALL lenses at once, over legal traces of at most `depth` steps from the initial state (every step's `requires` guard must hold). Report every candidate including uncertain ones.

- **invariant**: for each invariant, construct a legal trace ending in a state where it is false
- **forbidden**: for each forbidden flow, construct a legal trace that realizes it
- **liveness**: deadlocks (non-terminal state with no enabled action), livelocks (cycles that never reach a terminal state), started flows that some user choice makes unfinishable
- **refinement**: for each requirement, find one with no supporting transition path, or a legal trace that satisfies every guard yet defeats the requirement's intent

Adversarial toolkit: back navigation, cancel, retry, page reload, double-click/double-submit, concurrent tabs, permission or session change mid-flow, network failure at any step.

Each counterexample: `{ property, trace: ["state --action--> state (why the guard held)", …], explanation, severity ("critical"|"major"|"minor") }`.

Carry every candidate into Stage C — do not filter here.

### Stage C — Replay

Replay each candidate step by step against the Stage A machine and try to REFUTE it. Check: (1) it starts in the initial state; (2) every step's action exists and its `requires` guard holds in that step's source state; (3) the claimed violation actually holds at the end (for liveness: no enabled action escapes); (4) the trace is at most `depth` steps. Verdict CONFIRMED / PLAUSIBLE / REFUTED; REFUTED if any check fails; default to REFUTED when uncertain. Never add counterexamples Stage B did not raise.

You produced these candidates yourself, so re-derive each trace against the machine rather than trusting what Stage B concluded about it. **Every verdict's `verification` names the machine row, guard or check number it turned on** — a bare assertion is not a verdict. An action the machine does not model fails check (2): that is an ambiguity, not a counterexample, and the distinction between "the spec is silent" and "the design is safe" is the one this stage exists to hold.

### Stage D — Return

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
