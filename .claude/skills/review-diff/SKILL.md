---
name: review-diff
description: Unified pre-commit review of the uncommitted diff — a finder agent hunts across all lenses (bugs + AGENTS.md rules), then a separate verifier agent adversarially refutes each finding, and its completion stamps the commit gate (ADR-0009/0011/0015). Run before every commit, or whenever the uncommitted diff needs a full review. Pass "high" for a deeper multi-lens verify pass.
user_invocable: true
---

# Review Diff

Fresh-context review of the uncommitted diff before a commit (ADR-0009; flat two-agent mechanism per ADR-0015, superseding the nested orchestrator of ADR-0011). The review runs as **two parent-dispatched agents, each a fresh implementation-blind context**:

1. **`code-reviewer`** (finder) — reads the diff, reports candidate findings.
2. **`review-verifier`** (verifier) — refutes each candidate by reading the real code; its completion stamps the commit gate.

The parent orchestrates the two in sequence. Both are depth-1 dispatches the parent waits on directly — there is no nested "agent waiting on its own child," which was the fragile joint that lost verdicts under the old ADR-0011 design (2026-07-10 incidents). find ≠ verify independence is preserved because finder and verifier are separate fresh contexts; the parent only routes the structured candidate list between them and never does the finding or verifying itself.

Benchmarking (2026-07-04) already collapsed the old 5–7-lane parallel workflow to one comprehensive finder + one verifier at ~1/5 the cost; ADR-0015 keeps that shape and only unnests the verifier.

## Routing — how this runs

- **You are the parent session** (human invoked `/review-diff`, or start-workflow step 6):
  1. Dispatch the `code-reviewer` agent on the uncommitted diff (this clears any stale stamp — new cycle). It returns candidate findings as JSON.
  2. Dispatch the `review-verifier` agent, passing the candidate JSON verbatim plus the `mode` and `effort`. Do this **even when the finder returned zero candidates** (a clean diff still needs the verifier to run so the gate stamps). Wait for it; its completion stamps `.claude/.review-stamp`.
  3. Integrate the surviving findings it returns. Do NOT run the find/verify steps in the parent context yourself — the fresh agent contexts are the whole point.
  Pass `effort: high` through to both dispatches if the user asked for it.
- **You are the `code-reviewer` agent** (this skill is preloaded): execute **Find** (Steps 1–2) and return the candidate JSON. Do not verify, do not stamp, do not dispatch anything.
- **You are the `review-verifier` agent** (this skill is preloaded): execute **Verify** (Step 3) and **Return** (Step 4) against the candidates handed to you.

## When to run

- Step 6 of `start-workflow`, before proposing a commit.
- Any time the uncommitted diff needs a full review.
- Re-run after fixing findings (see Modes → delta).

## Effort

- **standard** (default): the verifier uses a single reproduction lens.
- **high**: the verifier uses three lenses (correctness, reproduction, scope) and a finding survives only if it is NOT refuted by a majority. Use for security-sensitive or high-blast-radius diffs.

## Modes

- **full** (default): find over the entire uncommitted diff.
- **delta**: re-review after a completed full review in the same task cycle.
  The finder dispatch prompt MUST include (i) the prior review report verbatim
  and (ii) a delta description listing the files/edits made since that review.
  Adjustments:
  - Scope the find pass to the delta files and their interaction with the prior
    findings (did a fix regress a neighbor? does a prior finding still apply?).
  - Do NOT re-run whole-project verification commands (typecheck / test /
    build / knip) that a full review may choose to run while tracing a
    finding — the parent's per-edit hooks and Stop gate own them. Reading code
    and read-only git commands are still expected.
  - The verifier still runs (zero candidates → verifier trivially confirms
    nothing and stamps, as in full mode).
  - **Fail closed to full mode** when the prior report is missing or partial,
    the delta description is ambiguous, or `git diff` shows changes outside the
    declared delta plus the prior review's scope. State the fallback in the
    report.
  - **Known trade**: delta mode does not re-examine previously-clean hunks of
    the same diff — a fix that breaks reviewed-but-clean code is invisible to
    it. Prefer full mode when fixes changed assumptions beyond the prior
    findings.
  Stamp semantics are identical in both modes: verifier completion stamps,
  finder dispatch clears (ADR-0013/0015).

## Procedure

**Target (finder):** the uncommitted diff. Run `git status`, `git diff HEAD`, and `git ls-files --others --exclude-standard`; read untracked files directly. If there are no uncommitted changes, return an empty candidate list.

### Step 1 — Find (all lenses, one pass) — `code-reviewer`

Read the diff once and hunt across ALL of these lenses at the same time. Report EVERY issue including uncertain ones (coverage-first; the verifier filters). Each finding needs a concrete failure scenario and a concrete fix.

- **logic**: off-by-one, inverted conditions, wrong operators, null/undefined handling, unhandled empty/extreme inputs
- **state**: race conditions, stale React state/closures, effects with wrong dependencies, shared mutable state, double submission
- **integrity**: swallowed errors, missing failure paths, partial writes, inconsistent persisted state, missing boundary validation
- **cleanup**: duplication, dead code, needless complexity, obvious performance problems, drift from surrounding conventions
- **rules**: read `AGENTS.md` AND every path-scoped rule file under `.claude/rules/` whose scope (listed in the AGENTS.md "Rules" section) matches files in the diff — these are NOT auto-loaded, read them — and review against them. Set `rule` to the violated rule and never dismiss a finding as "pre-existing" when the file is in the diff.

Each finding: `{ file (repo-relative), line (1-indexed), title, description (failure scenario + concrete fix), severity ("critical"|"major"|"minor"), rule? }`.

### Step 2 — Dedup + return candidates — `code-reviewer`

Merge findings anchored to the same (file, line): keep the highest-severity one, fold the others into its description. Sort by severity. Return `{ mode, fallback?, candidates: [ ... ], stats: { candidates } }` as your final message. Stop here — you do not verify or stamp.

### Step 3 — Verify — `review-verifier`

You are given the candidate list as JSON plus `mode` and `effort`. Try to REFUTE each candidate by reading the actual code (your context did not see the find pass — keep that independence):

- **standard**: one reproduction lens — walk the failure scenario step by step through the real code.
- **high**: three lenses per finding — correctness (is the claimed behavior actually wrong?), reproduction (walk it step by step), scope (does the cited rule/expectation actually apply?) — refute if a majority of lenses refute.

If a finding cites an AGENTS.md rule, read AGENTS.md and respect rule scope qualifiers. Verdict per finding: CONFIRMED (traced the failure/violation in real code), PLAUSIBLE (credible but not fully traced), REFUTED (does not hold). Default to REFUTED when uncertain. You may regrade severity. Never add findings the finder did not raise.

### Step 4 — Return — `review-verifier`

Drop REFUTED findings. Sort survivors by verdict (CONFIRMED first) then severity. Return:

```
{ effort, mode, fallback?, findings: [ { file, line, title, description, severity, verdict, verification } ], stats: { candidates, refuted } }
```

`mode`/`fallback` are echoed from the finder. Do NOT manually create `.claude/.review-stamp` — the `PostToolUse(Agent)` hook stamps it when you (the `review-verifier` agent) complete.

**Fail-closed (parent responsibility).** The gate is deterministic (ADR-0015): the hook stamps on a `review-verifier` completion ONLY if a `code-reviewer` finder ran this cycle (it left `.claude/.finder-done`) AND the diff hash then equals the diff hash now (no edit slipped in between). Consequences the parent must respect:
- Always run the finder first, then the verifier, back-to-back — do not edit files between the two dispatches (an edit changes the diff hash → no stamp → re-review).
- If the `review-verifier` dispatch errors, times out, or returns a malformed/empty report, treat the review as NOT done — the surviving findings are unverified. Do not commit; re-dispatch the verifier (or the whole pipeline). A completed-but-degenerate verifier response is not a clean pass.
- Dispatching `review-verifier` alone (without a fresh finder) will not stamp the gate — this is intentional; the stamp proves find→verify ran on the current diff, not merely that a verifier completed.

## After the review (parent session)

1. Read the surviving findings. Never dismiss a finding as "pre-existing" when the file is in the diff. Apply rules literally; when in doubt, fix.
2. The parent fixes findings directly (this clears the stamp via the per-edit hook — a re-review is required before committing).
3. Re-review after fixing: prefer **delta mode** (pass the prior report verbatim + the delta description to the finder); use **full mode** after major rework.
