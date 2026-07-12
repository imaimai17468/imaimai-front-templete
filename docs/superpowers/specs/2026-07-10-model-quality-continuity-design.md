# Model Quality Continuity & Review Pipeline Efficiency — Design

- Date: 2026-07-10
- Status: approved direction, pending implementation
- Driver: prepare for sessions where the parent model is Opus (or weaker) instead of
  Fable, without losing output quality; and cut the observed waste in the
  review/verify subagent pipelines.

## Problem

1. **Model continuity.** The repo's quality mechanisms (deterministic gates
   ADR-0013, pinned review agents ADR-0011, Aegis context compilation) make
   enforcement model-independent, but the *judgment* produced by the best
   available model (currently Fable) — design decisions, investigation
   playbooks, escalation instincts — dies with each session unless it happens
   to land in an ADR. There is no standing cycle that converts best-model
   judgment into artifacts a weaker parent can execute.
2. **Review pipeline waste.** Session data (2026-07-10): three `code-reviewer`
   runs, 54k–105k tokens, 3–5 min each. Two of the three were re-reviews forced
   by ADR-0013 stamp-clearing, and each re-review re-read the full diff and
   re-ran whole-project verification the parent had already run.

The two problems share one axis: move quality from "which model is driving"
into artifacts and procedure.

## Design principle

Adopt the cycle of [shadcn/improve](https://github.com/shadcn/improve)
("audit with your best model, execute with a cheap one; plans are portable
Markdown") **without importing its artifact system**. Aegis is the delivery
rail for knowledge; `docs/superpowers/specs/` + `/start-workflow` is the rail
for work. The audit cycle only *produces* into those existing rails — no third
document format.

**Phase ordering is measurement-first**: the eval (the measuring stick) is
built before the change it must judge, so every later phase lands with a
baseline comparison, not a functional check alone. Each phase completes with
its effect verified before the next starts.

## Phase 1 — Golden eval + baseline for the review pipeline

- 3–5 seeded-defect diffs stored as patch files (not fixture branches — a
  branch rots as main evolves; a patch declares its own base) with
  expected-findings lists, under `docs/superpowers/evals/review-diff/`.
- At least one fixture is a **delta scenario** (a prior review report + a
  small follow-up edit), so Phase 2's delta mode is directly measurable.
- Run via the existing `empirical-prompt-tuning` skill: dispatch the pinned
  `code-reviewer` against each fixture, score found/missed/false-positive,
  and record tokens + wall time per run.
- **Deliverable**: fixtures + a scored, costed baseline for the current
  sonnet reviewer, recorded next to the fixtures. Model-tier changes to
  `.claude/agents/*.md` from here on require an eval run, not vibes.

## Phase 2 — Review efficiency + non-Fable-parent operating rules

Verified against the Phase 1 baseline: quality non-regression on the eval set
plus directly measured token/latency reduction on the delta fixture.

### 2a. Delta re-review mode in `review-diff`

- **Trigger**: the parent re-dispatches `code-reviewer` after a completed
  full review in the same task cycle, passing (i) the prior review report
  verbatim and (ii) the delta description (files/edits since that review).
- **Behavior**: the finder reviews only the delta and its interaction with the
  prior findings; it does NOT re-run whole-project verification commands
  (the parent's Stop gate and per-edit hooks own that); the verifier child
  remains mandatory for any new candidate finding (zero candidates → no child,
  as today).
- **Fail-closed**: missing prior report, ambiguous delta, or delta touching
  files outside the prior review's scope → the agent falls back to a full
  review on its own judgment. The stamp semantics (ADR-0011/0013) are
  unchanged: completion stamps, dispatch clears.

### 2b. "Non-Fable parent" operating rules (AGENTS.md section)

A short AGENTS.md subsection under Agents, stating:

- Review/verify quality is pinned by skills + gates and does not degrade with
  the parent model; do not re-derive or second-guess the pinned procedures.
- When the parent is not the strongest available model: escalate **design
  judgment** (architecture choices, ADR drafting, ambiguous trade-offs) to an
  `opus` (or strongest-available) subagent dispatch, or stop and ask the user.
  Mechanical implementation stays in the parent.
- The Knowledge Currency rules (mandatory WebSearch before versioned claims,
  empirical verification of surprising behavior) apply with extra force — a
  weaker parent must verify more, not less.

## Phase 3 — Native audit cycle (best-model judgment → existing rails)

A lightweight skill (working name: `repo-audit`) run on demand with the best
available model. Explicitly NOT scheduled and NOT CI-integrated initially.
Effect verification: one real audit run produces correctly-routed outputs (or
a clean "nothing new"); its cost is recorded to judge whether the cycle earns
its keep.

- **Lanes**: only what deterministic gates cannot catch — architecture drift
  vs ADRs, security posture, dependency strategy, doc staleness/DX. Lint,
  types, tests, dead code, formatting are out of scope (gates own them).
- **Mechanism**: fan out read-only Explore lanes (haiku/sonnet), findings
  synthesized by the parent (best model) — judgment stays in the strongest
  context, exploration stays cheap.
- **Outputs — routed, never a new format**:
  - *Knowledge* (a rule, a convention, a decision) → ADR draft or AGENTS.md
    edit → aegis-share flow (`source` + `edges` → materialize → export) so
    Aegis delivers it to every future session regardless of model.
  - *Work* (something to fix or build) → a plan doc in
    `docs/superpowers/specs/`, executable later by any model via
    `/start-workflow` / `executing-plans`.
- An audit that finds nothing new writes nothing (no ritual artifacts).

## Out of scope

- Installing shadcn/improve as-is (overlaps Aegis; third artifact format).
- Scheduled/cron audits, CI-integrated audits.
- Any change to the commit-gate contract (ADR-0011/0013 semantics unchanged).

## Consequences / risks

- `review-diff` skill changes are load-bearing for every commit (ADR-0011);
  the delta-mode edit ships with a fail-closed default and its tuning happens
  against the Phase 1 eval (which subsumes the empirical-tuning obligation
  with a repeatable, scored variant of it).
- Phase 3's value depends on actually running audits; if unused after a
  reasonable period, delete the skill rather than letting it rot (ADR-0011's
  code-graph lesson).
- Eval fixtures go stale as the codebase evolves; each eval run sanity-checks
  that fixtures still apply before scoring, and a fixture that no longer
  applies is regenerated or retired in the same run.

## Acceptance criteria

- Phase 1: eval fixtures exist (≥1 delta scenario); one scored, costed
  baseline run for the current sonnet reviewer is recorded next to them.
- Phase 2: delta re-review passes the eval with no quality regression vs
  baseline and measurably lower cost on the delta fixture; AGENTS.md section
  exists; commit gate behavior unchanged (verified by attempting a commit
  without review → blocked).
- Phase 3: one real audit run produces at least one correctly-routed output
  (or a clean "nothing new" result) without creating any new document format.
