---
name: review-diff
description: Unified pre-commit review of the uncommitted diff — one comprehensive finder (bug hunt across all lenses + AGENTS.md rules) → adversarial verifier child → ranked findings → commit-gate stamp (ADR-0009/0011). Run before every commit, or whenever the uncommitted diff needs a full review. Pass "high" for a deeper multi-lens verify pass.
user_invocable: true
---

# Review Diff

Fresh-context review of the uncommitted diff before a commit (ADR-0009, mechanism per ADR-0011). This skill is **preloaded into the `code-reviewer` agent** (`.claude/agents/code-reviewer.md`) — that agent is the reviewer. The agent finds issues across all lenses, dispatches a **separate verifier child** to adversarially refute each, and its completion stamps the commit gate. Because the agent's context never saw the implementation reasoning, it is the bias check.

Benchmarking (2026-07-04) showed the old parallel workflow (5–7 finder lanes × N verifiers) burned ~1.1M tokens per run rediscovering the same bugs. This collapses to **1 comprehensive finder + 1 verifier child** at ~1/5 the cost.

## Routing — how this runs

- **Human invoked `/review-diff` (you are the parent session):** dispatch the `code-reviewer` agent on the uncommitted diff and integrate what it returns. Do NOT run the steps below in the parent context — the fresh, implementation-blind agent context is the whole point, and dispatching `code-reviewer` is what triggers the commit-gate stamp hook. Pass `effort: high` through in the dispatch prompt if the user asked for it.
- **You are the `code-reviewer` agent (this skill is preloaded):** execute the procedure below directly.

## When to run

- Step 6 of `start-workflow`, before proposing a commit.
- Any time the uncommitted diff needs a full review.
- Re-run after major rework (not after every small fix — the parent fixes findings directly).

## Effort

- **standard** (default): verifier child uses a single reproduction lens.
- **high**: verifier child uses three lenses (correctness, reproduction, scope) and a finding survives only if it is NOT refuted by a majority. Use for security-sensitive or high-blast-radius diffs.

## Modes

- **full** (default): the procedure below over the entire uncommitted diff.
- **delta**: re-review after a completed full review in the same task cycle.
  The dispatch prompt MUST include (i) the prior review report verbatim and
  (ii) a delta description listing the files/edits made since that review.
  Procedure adjustments:
  - Scope Step 1 to the delta files and their interaction with the prior
    findings (did a fix regress a neighbor? does a prior finding still
    apply?).
  - Do NOT re-run whole-project verification commands (typecheck / test /
    build / knip) that a full review may choose to run while tracing a
    finding — the parent's per-edit hooks and Stop gate own them. Reading
    code and read-only git commands are still expected.
  - The verifier child remains mandatory for new candidates (zero
    candidates → no child, as in full mode).
  - **Fail closed to full mode** when the prior report is missing or partial,
    the delta description is ambiguous, or `git diff` shows changes outside
    the declared delta plus the prior review's scope. State the fallback in
    the report.
  Stamp semantics are identical in both modes: completion stamps, dispatch
  clears (ADR-0011/0013).

## Procedure (executed by the code-reviewer agent)

**Target:** the uncommitted diff. Run `git status`, `git diff HEAD`, and `git ls-files --others --exclude-standard`; read untracked files directly. If there are no uncommitted changes, return an empty findings list and stop (your completion still stamps the gate).

### Step 1 — Find (all lenses, one pass)

Read the diff once and hunt across ALL of these lenses at the same time. Report EVERY issue including uncertain ones (coverage-first; the verifier filters). Each finding needs a concrete failure scenario and a concrete fix.

- **logic**: off-by-one, inverted conditions, wrong operators, null/undefined handling, unhandled empty/extreme inputs
- **state**: race conditions, stale React state/closures, effects with wrong dependencies, shared mutable state, double submission
- **integrity**: swallowed errors, missing failure paths, partial writes, inconsistent persisted state, missing boundary validation
- **cleanup**: duplication, dead code, needless complexity, obvious performance problems, drift from surrounding conventions
- **rules**: read `AGENTS.md` AND every path-scoped rule file under `.claude/rules/` whose scope (listed in the AGENTS.md "Rules" section) matches files in the diff — these are NOT auto-loaded, read them — and review against them. Set `rule` to the violated rule and never dismiss a finding as "pre-existing" when the file is in the diff.

Each finding: `{ file (repo-relative), line (1-indexed), title, description (failure scenario + concrete fix), severity ("critical"|"major"|"minor"), rule? }`.

### Step 2 — Dedup

Merge findings anchored to the same (file, line): keep the highest-severity one, fold the others into its description. Sort by severity (critical > major > minor).

### Step 3 — Verify (dispatch a separate child — do not verify your own findings)

Dispatch ONE verifier child agent (`model: sonnet`, `subagent_type: general-purpose`) with a self-contained prompt containing the full deduped findings list as JSON. **Wait for the child in the foreground — do not end your turn while it runs**; a backgrounded child's verdicts are unretrievable and force the fail-closed unverified path for no reason. Instruct it to try to REFUTE each finding by reading the actual code:

- **standard**: one reproduction lens — walk the failure scenario step by step through the real code.
- **high**: three lenses per finding — correctness (is the claimed behavior actually wrong?), reproduction (walk it step by step), scope (does the cited rule/expectation actually apply?) — refute if a majority of lenses refute.

If a finding cites an AGENTS.md rule, the child reads AGENTS.md and respects rule scope qualifiers. Verdict per finding: CONFIRMED (traced the failure/violation in real code), PLAUSIBLE (credible but not fully traced), REFUTED (does not hold). Default to REFUTED when uncertain. The child may regrade severity.

If the verifier child fails entirely, keep the findings marked unverified rather than dropping them (fail-closed on precision, not on coverage).

### Step 4 — Return

Drop REFUTED findings. Sort survivors by verdict (CONFIRMED first) then severity. Return:

```
{ effort, mode, fallback?, findings: [ { file, line, title, description, severity, verdict, verification } ], stats: { candidates, refuted } }
```

`mode` is the mode actually executed (`"full"` | `"delta"`); `fallback` is
present only when a delta dispatch fell back to full, stating the reason.

Do NOT manually create `.claude/.review-stamp` — a `PostToolUse(Agent)` hook stamps it automatically when you (the `code-reviewer` agent) complete.

## After the review (parent session)

1. Read the findings. Never dismiss a finding as "pre-existing" when the file is in the diff. Apply rules literally; when in doubt, fix.
2. The parent fixes findings directly.
3. Re-review (re-dispatch `code-reviewer`) after fixing findings: prefer
   **delta mode** (pass the prior report verbatim + the delta description);
   use **full mode** after major rework.
