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
  2. Dispatch the `review-verifier` agent, passing the candidate JSON verbatim plus the `effort`. Do this **even when the finder returned zero candidates** (a clean diff still needs the verifier to run so the gate stamps). Wait for it; its completion stamps `.claude/.review-stamp`.
  3. Integrate the surviving findings it returns. Do NOT run the find/verify steps in the parent context yourself — the fresh agent contexts are the whole point.
  Pass `effort: high` through to both dispatches if the user asked for it.
  **Neither agent has a web tool** (`tools: Read, Bash, Skill`), so neither can
  check a claim about how an external tool behaves — a CLI flag, a config key, a
  framework's API. When the diff makes such a claim, verify it yourself and put
  the quote and its URL in both dispatch prompts. Without that they can only
  report it as unverified, which is correct of them and useless to you.
- **You are the `code-reviewer` agent** (this skill is preloaded): execute **Find** (Steps 1–2) and return the candidate JSON. Do not verify, do not stamp, do not dispatch anything.
- **You are the `review-verifier` agent** (this skill is preloaded): execute **Verify** (Step 3) and **Return** (Step 4) against the candidates handed to you.

### The briefing (parent) — required slots

The procedure above is pinned; the dispatch prompt is not — it is written from scratch every time. Fill every slot below in both dispatches. A slot with nothing to say gets one line saying so: an omitted slot reads as "not applicable" when it usually means "not thought about".

**No hook checks that these slots are filled** — a known limitation, not a claim of enforcement. This repo has rejected instruction-only mitigations three times (ADR-0001 on skill invocation, ADR-0013 on warn-not-block, ADR-0019 on delta mode). This one is kept anyway because it downgrades no mechanism: before it the dispatch prompt had no guidance at all.

- **Diff scope.** The paths, and the command that actually shows them. `git diff` shows neither staged-only nor untracked files, so name `git diff --cached` and list new files explicitly when the change includes them. A new file the finder never saw is not a reviewed file.
- **What changed and why.** The intent, in a few sentences. Whether the code does what was meant is only checkable by someone who was told what was meant.
- **Out of scope.** Earlier commits on the branch, adjacent files, known debt — what must not be re-reported, and why it is out. Without this the finder either re-reports settled ground or silently treats it as fair game.
- **Claims to check.** The two or three things you are least sure of, written as claims rather than areas: "confirm this cannot abort under `set -e`" gets checked, "review the hook" does not.
- **External tool behaviour.** Handled by the parent routing bullet above ("Neither agent has a web tool…") — nothing to add here beyond following it.
- **Ordering.** State that the verifier follows and that you will not edit between the two dispatches — saying it also tells the finder its report is an input, not a verdict. See "Fail-closed" below for the mechanism that enforces it either way. The constraint was already written down when it was broken on 2026-07-28 — findings fixed before the verifier ran, costing an entire extra find+verify pair (ADR-0019).

The verifier's briefing carries the candidate JSON verbatim, the same slots, and one more: **what to challenge hardest.** Name the candidates whose truth would change the fix, and say plainly where a candidate contradicts something you wrote — that is the cue to re-derive it rather than defer to the finder.

## When to run

- Step 6 of `start-workflow`, before proposing a commit.
- Any time the uncommitted diff needs a full review.

**Once per commit.** Fixing what the verifier confirmed does not require running
this again — the stamp survives those edits (ADR-0019). The pass ends at the fix.

## Effort

- **standard** (default): the verifier uses a single reproduction lens.
- **high**: the verifier uses three lenses (correctness, reproduction, scope) and a finding survives only if it is NOT refuted by a majority. Use for security-sensitive or high-blast-radius diffs.

There is one mode: find over the entire uncommitted diff. The pass runs once per
commit and ends at the fix (ADR-0019) — there is no re-review mode to reach for,
and a partial-scope re-run no longer exists.

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

**Signal-to-noise on benign diffs.** Coverage-first applies fully to correctness lenses (logic/state/integrity) and to rule violations — report every candidate there. But for `cleanup` and process/style observations (naming drift, commit-split hygiene, "could centralize this constant"), calibrate to the diff: when the change is behavior-identical (a pure rename, a constant extraction, a doc reword) and carries no critical/major finding, a minor cleanup/process comment is usually noise, not a defect — a benign refactor should draw few or no findings. Raise such a comment only when it is genuinely actionable and material; otherwise omit it. This does not lower the bar on real bugs or rule breaches (those are always reported); it keeps the finder from burying a clean refactor in true-but-trivial remarks. (Golden-eval fixtures fx-06/fx-07 measure exactly this over-reporting tendency — ADR-0014.)

### Step 2 — Dedup + return candidates — `code-reviewer`

Merge findings anchored to the same (file, line): keep the highest-severity one, fold the others into its description. Sort by severity. Return `{ candidates: [ ... ], stats: { candidates } }` as your final message. Stop here — you do not verify or stamp.

### Step 3 — Verify — `review-verifier`

You are given the candidate list as JSON plus `effort`. Try to REFUTE each candidate by reading the actual code (your context did not see the find pass — keep that independence):

- **standard**: one reproduction lens — walk the failure scenario step by step through the real code.
- **high**: three lenses per finding — correctness (is the claimed behavior actually wrong?), reproduction (walk it step by step), scope (does the cited rule/expectation actually apply?) — refute if a majority of lenses refute.

If a finding cites an AGENTS.md rule, read AGENTS.md and respect rule scope qualifiers. Verdict per finding: CONFIRMED (traced the failure/violation in real code), PLAUSIBLE (credible but not fully traced), REFUTED (does not hold). Default to REFUTED when uncertain. You may regrade severity. Never add findings the finder did not raise.

**For every finding you do not refute, also decide the fix.** The review is one pass (ADR-0019): the parent applies what you return and commits, so a finding you leave without a fix is a finding whose remedy nobody judged. Two fields per surviving finding:

- `fix` — the concrete change. Which file, what it should say instead, and why that shape rather than the alternative you considered. Not a restatement of the problem: "validate the size server-side" is not a fix, "add `avatarSizeRejection(file.size)` to `uploadAvatarFn`'s `inputValidator`, sharing `MAX_AVATAR_BYTES` with the client so the two cannot drift" is.
- `acceptance` — how the parent confirms it landed, checkable without re-running this review: a command, or a specific observable in the code.

The finder's embedded fix suggestion (inside its `description`) is input, not the answer — it was written before anyone established the finding was real. Read it, adopt it if it holds up, but the `fix` you return is the authoritative one.

When a finding cannot be fixed without a decision that is not yours to make — an ADR-level choice, a genuine trade-off, a question for the repository owner — put that in `fix` explicitly and say what the options are. Do **not** invent a fix to fill the field; an honest "this needs a decision, here are the two credible options" is the useful answer and tells the parent to ask rather than guess. For such a finding `acceptance` states what the parent will be able to observe once the owner has picked — which file or section will name the chosen option. Never leave it blank, and never assert a false certainty to fill it.

### Step 4 — Return — `review-verifier`

Drop REFUTED findings. Sort survivors by verdict (CONFIRMED first) then severity. Return:

```
{ effort, findings: [ { file, line, title, description, severity, verdict, verification, fix, acceptance } ], stats: { candidates, refuted } }
```

Do NOT manually create `.claude/.review-stamp` — the `PostToolUse(Agent)` hook stamps it when you (the `review-verifier` agent) complete.

**Fail-closed (parent responsibility).** The gate is deterministic (ADR-0015): the hook stamps on a `review-verifier` completion ONLY if a `code-reviewer` finder ran this cycle (it left `.claude/.finder-done`) AND the diff hash then equals the diff hash now (no edit slipped in between). Consequences the parent must respect:
- Always run the finder first, then the verifier, back-to-back — do not edit files between the two dispatches (an edit changes the diff hash → no stamp → the whole pass has to run again). Fix *after* the verifier returns, not before: those edits are the only ones the stamp survives.
- If the `review-verifier` dispatch errors, times out, or returns a malformed/empty report, treat the review as NOT done — the surviving findings are unverified. Do not commit; re-dispatch the verifier (or the whole pipeline). A completed-but-degenerate verifier response is not a clean pass.
- Dispatching `review-verifier` alone (without a fresh finder) will not stamp the gate — this is intentional; the stamp proves find→verify ran on the current diff, not merely that a verifier completed.

## After the review (parent session)

1. Read the surviving findings. Never dismiss a finding as "pre-existing" when the file is in the diff. Apply rules literally; when in doubt, fix.
2. **Apply each finding's `fix` and check its `acceptance`.** The fix was judged by a context that did not write the code; that is the point of it arriving with the finding. Departing from it is allowed — you can see things the verifier could not — but then say so and why, in the commit message or to the user. Where `fix` says the finding needs a decision, ask the user rather than picking for them.
3. That is **the end of the review** (ADR-0019). Those edits keep the stamp, so commit once every finding is addressed or explicitly justified as out of scope. Running this skill again is a fresh review of a fresh diff, not a follow-up on this one.
