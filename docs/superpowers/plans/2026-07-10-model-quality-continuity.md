# Model Quality Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a measurement-first pipeline: golden eval + baseline for `code-reviewer`, then a delta re-review mode and non-Fable-parent rules verified against that baseline, then an on-demand `repo-audit` skill that routes best-model judgment into the repo's existing artifact rails.

**Architecture:** Spec: `docs/superpowers/specs/2026-07-10-model-quality-continuity-design.md`. Three phases, each verified before the next: (1) eval fixtures as patch files + scored/costed baseline of the current sonnet reviewer; (2) `review-diff` gains a fail-closed delta mode, AGENTS.md gains model-continuity rules, both proven by eval re-run; (3) `repo-audit` skill producing only into ADR/AGENTS.md (via aegis-share) or `docs/superpowers/specs/` plans.

**Tech Stack:** Claude Code agents/skills (Markdown), git patch fixtures, Aegis CLI `@fuwasegu/aegis@1.7.0`.

## Global Constraints

- Agent-facing docs (`.claude/`, AGENTS.md, `docs/adr/`) are written in English (AGENTS.md rule).
- Never commit without explicit user confirmation; every commit needs a completed `code-reviewer` dispatch (commit gate). This plan commits **once per phase** to bound review cost.
- Aegis KB changes go through aegis-share: edit `aegis-share/source/` → `share-format` → `share-lint` → `share-materialize` → `share-export` (never `aegis_import_doc` directly).
- Eval runs dispatch the real `code-reviewer` agent, which stamps `.claude/.review-stamp`; every eval session ends by deleting the stamp so an eval never unlocks an unrelated commit.
- No new document formats: audit outputs are ADR/AGENTS.md edits or `docs/superpowers/specs/` plan docs only.
- Fixture patches must leave the working tree byte-identical after `git apply -R` (verify with `git status --short` empty each time).

---

## Phase 1 — Golden eval + baseline

### Task 1: Eval harness definition

**Files:**
- Create: `docs/superpowers/evals/review-diff/README.md`

**Interfaces:**
- Produces: the fixture layout and run protocol every later task follows: `fx-NN/seed.patch`, `fx-NN/expected.md`, optional `fx-NN/prior-report.md`; results files `results/<date>-<label>.md`.

- [ ] **Step 1: Write the README**

```markdown
# review-diff golden eval

Seeded-defect fixtures measuring the `code-reviewer` agent (find + verify
pipeline). Each fixture is a patch file (self-declared base) + an expected
findings list. Scores and costs are recorded per run; model-tier changes to
`.claude/agents/*.md` require a run recorded here (AGENTS.md, Model
continuity).

## Layout

- `fx-NN/seed.patch` — unified diff that seeds the defect(s); applies to a
  clean tree with `git apply`.
- `fx-NN/expected.md` — base commit hash, the expected findings (file +
  nature), and known-acceptable extras.
- `fx-NN/prior-report.md` — only for delta-scenario fixtures: the prior full
  review report to pass in the dispatch prompt.
- `results/<date>-<label>.md` — one file per run set.

## Run protocol (parent session, clean tree required)

Per fixture:
1. `git apply docs/superpowers/evals/review-diff/fx-NN/seed.patch`
2. Dispatch the `code-reviewer` agent (model per its definition, effort
   standard). For delta fixtures, include `prior-report.md` verbatim and the
   delta description in the dispatch prompt.
3. Record from the agent result: findings, subagent tokens, wall time.
4. `git apply -R docs/superpowers/evals/review-diff/fx-NN/seed.patch`;
   verify `git status --short` is clean.

After all fixtures: `rm -f .claude/.review-stamp` (an eval run must never
satisfy the commit gate for real work).

## Scoring

- **found** — an expected finding is reported (same file, same defect nature;
  wording free).
- **missed** — an expected finding absent from the surviving findings.
- **false positive** — a surviving CONFIRMED finding not in expected.md and
  not listed as acceptable-extra.
- Staleness: if `seed.patch` no longer applies, regenerate or retire the
  fixture in the same run and note it in the results file.

## Fixture inventory

| id | seeds | expected core finding |
|---|---|---|
| fx-01 | logic/boundary (zod min) | empty name accepted, message contradicts |
| fx-02 | AGENTS.md type-escape (`as`) | banned assertion in ProfileForm |
| fx-03 | react.md purity (Math.random in render) | non-idempotent render in UserMenu |
| fx-04 | integrity (swallowed error) | success toast on failed update |
| fx-05 | delta scenario (zod max vs message) | limit/message contradiction; delta-scoped |
```

- [ ] **Step 2: Verify file exists and README renders**

Run: `ls docs/superpowers/evals/review-diff/ && head -5 docs/superpowers/evals/review-diff/README.md`
Expected: README.md listed, header printed.

### Task 2: Full-review fixtures fx-01…fx-04

**Files:**
- Create: `docs/superpowers/evals/review-diff/fx-01/{seed.patch,expected.md}` … `fx-04/…`
- Touched-then-reverted: `src/entities/user/index.ts`, `src/components/features/profile-page/profile-form/ProfileForm.tsx`, `src/components/shared/header/user-menu/UserMenu.tsx`

**Interfaces:**
- Consumes: Task 1 layout.
- Produces: four applicable patches + expected lists used by Task 4/7.

For EACH fixture: apply the edit below with the Edit tool, then

```bash
git diff -- <file> > docs/superpowers/evals/review-diff/fx-NN/seed.patch
git apply -R docs/superpowers/evals/review-diff/fx-NN/seed.patch
git status --short   # must be clean for src/
```

then write `expected.md` (template below), filling `base:` with `git rev-parse HEAD`.

```markdown
# fx-NN
base: <commit hash>
## Expected findings
- file: <repo-relative path>
  nature: <one sentence: the defect the reviewer must report>
  severity-floor: minor
## Acceptable extras
- <known side-findings that do not count as false positives; "none" if none>
```

- [ ] **Step 1: fx-01 — logic/boundary.** In `src/entities/user/index.ts` change `.min(1, "Name is required")` → `.min(0, "Name is required")`. Expected nature: "UpdateUserSchema accepts an empty name; min(0) contradicts the 'Name is required' message and the required-name contract". Acceptable extra: "index.test.ts branch coverage for min boundary not updated".
- [ ] **Step 2: fx-02 — type escape.** In `ProfileForm.tsx` change `const result = await updateProfileFn({ data: formData });` → `const result = (await updateProfileFn({ data: formData })) as { error?: string };`. Expected nature: "banned `as` assertion (AGENTS.md 'Never escape the type system'), rule cited". Acceptable extras: none.
- [ ] **Step 3: fx-03 — render purity.** In `UserMenu.tsx` insert after `const email = user.email;`:

```tsx
  const sessionLabel = `Session ${Math.random().toString(36).slice(2, 7)}`;
```

and inside the `DropdownMenuLabel` div, after the email `<p>`, add:

```tsx
            <p className="text-muted-foreground text-xs leading-none">
              {sessionLabel}
            </p>
```

Expected nature: "Math.random() during render violates react.md idempotency; value changes every re-render". Acceptable extras: none.
- [ ] **Step 4: fx-04 — swallowed error.** In `ProfileForm.tsx` replace

```tsx
      const result = await updateProfileFn({ data: formData });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated successfully");
      }
```

with

```tsx
      await updateProfileFn({ data: formData });
      toast.success("Profile updated successfully");
```

Expected nature: "update failure path dropped — success toast shown even when updateProfileFn returns an error (integrity)". Acceptable extras: none.
- [ ] **Step 5: Verify all four patches round-trip.** For each: `git apply <patch> && git apply -R <patch>`; `git status --short` clean each time.

### Task 3: Delta-scenario fixture fx-05

**Files:**
- Create: `docs/superpowers/evals/review-diff/fx-05/{seed.patch,expected.md,prior-report.md}`

**Interfaces:**
- Consumes: Task 1 layout.
- Produces: the fixture Task 4 runs as a FULL review (cost X) and Task 7 re-runs in delta mode (cost Y); Y vs X is the Phase 2 cost evidence.

- [ ] **Step 1: seed edit.** In `src/entities/user/index.ts` change `.max(50, "Name must be 50 characters or less")` → `.max(500, "Name can be at most 50 characters")` (benign wording change + limit/message contradiction). Generate/revert patch as in Task 2.
- [ ] **Step 2: expected.md.** Expected nature: "max(500) contradicts its own '50 characters' message (and the 50-char product limit)". Acceptable extras: none.
- [ ] **Step 3: prior-report.md** — the fabricated prior full review the delta dispatch will quote:

```markdown
# Prior full review (for delta dispatch)
Reviewed the full uncommitted diff at the fixture base; findings: none.
Verification at review time: typecheck/test/lint all passing.
Delta since this review: one edit to src/entities/user/index.ts adjusting the
UpdateUserSchema name max-length rule and its message.
```

### Task 4: Baseline run + Phase 1 commit

**Files:**
- Create: `docs/superpowers/evals/review-diff/results/2026-07-10-baseline-sonnet.md`

**Interfaces:**
- Consumes: fx-01…fx-05.
- Produces: the baseline table Phase 2 compares against (per-fixture: found/missed/FP, tokens, seconds; fx-05 run as FULL review).

- [ ] **Step 0: Phase 1a commit — harness + fixtures BEFORE any run.** The
  baseline dispatch must see ONLY the seed patch as the uncommitted diff; if
  the eval docs (containing `expected.md` answers) are still uncommitted, the
  reviewer can read the answers in its own review target. Ask the user,
  dispatch `code-reviewer`, then commit the harness, fixtures, spec, and plan
  docs.
- [ ] **Step 1:** Confirm clean tree (`git status --short` fully empty).
- [ ] **Step 2:** Run the protocol for fx-01…fx-05 (fx-05 as a normal full review — no prior report passed). One fixture at a time, never parallel (they share files and there is one stamp).
- [ ] **Step 3:** Write the results file:

```markdown
# Baseline — code-reviewer (sonnet), effort standard, 2026-07-10
| fixture | found | missed | FP | tokens | wall time |
|---|---|---|---|---|---|
| fx-01 | … | … | … | … | … |
…
Notes: <verifier verdicts, fallbacks, anomalies>
```

- [ ] **Step 4:** `rm -f .claude/.review-stamp`.
- [ ] **Step 5:** Acceptance check (spec Phase 1): fixtures exist incl. delta scenario; scored+costed baseline recorded. If any fixture scored `missed`, keep it — a baseline miss is data, not a defect to hide.
- [ ] **Step 6: Phase 1b commit — baseline results** (ask the user first; dispatch `code-reviewer` on the diff, address findings):

```bash
git add docs/superpowers/evals/review-diff/results/
git commit  # feat: sonnet レビュアーのベースライン計測結果を記録する (body: summary numbers; Co-Authored-By trailer)
```

---

## Phase 2 — Delta re-review mode + non-Fable-parent rules

### Task 5: `review-diff` delta mode

**Files:**
- Modify: `.claude/skills/review-diff/SKILL.md` (after the `## Effort` section; and the `## After the review` list)

**Interfaces:**
- Consumes: nothing new.
- Produces: dispatch contract used by Task 7 and by every future re-review: prior report verbatim + delta description in the dispatch prompt.

- [ ] **Step 1:** Insert after the `## Effort` section:

```markdown
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
    build / knip) — the parent's per-edit hooks and Stop gate own them.
    Reading code and read-only git commands are still expected.
  - The verifier child remains mandatory for new candidates (zero
    candidates → no child, as in full mode).
  - **Fail closed to full mode** when the prior report is missing or partial,
    the delta description is ambiguous, or `git diff` shows changes outside
    the declared delta plus the prior review's scope. State the fallback in
    the report.
  Stamp semantics are identical in both modes: completion stamps, dispatch
  clears (ADR-0011/0013).
```

- [ ] **Step 2:** Replace `## After the review` item 3 (`3. Re-review (re-dispatch \`code-reviewer\`) only after major rework.`) with:

```markdown
3. Re-review (re-dispatch `code-reviewer`) after fixing findings: prefer
   **delta mode** (pass the prior report verbatim + the delta description);
   use **full mode** after major rework.
```

- [ ] **Step 3:** Read the modified SKILL.md once end-to-end; confirm no contradiction with the Routing/Procedure sections (the finder target line still says "the uncommitted diff" — delta mode narrows it via the Modes section, no further edit needed).

### Task 6: AGENTS.md model-continuity section

**Files:**
- Modify: `AGENTS.md` (insert after the `### Model selection` table, before `### Teams & nesting`)

- [ ] **Step 1:** Insert:

```markdown
### Model continuity (non-Fable parent)

Review/verify quality is pinned by preloaded skills and deterministic gates
(ADR-0011/0013) and does not depend on the parent model — never re-derive or
second-guess a pinned procedure. When the parent session runs on a weaker
model than the strongest available (e.g. Opus instead of Fable):

- Escalate **design judgment** — architecture choices, ADR drafting,
  ambiguous trade-offs — to a subagent on the strongest available model, or
  stop and ask the user. Mechanical implementation stays in the parent.
- Knowledge Currency applies with extra force: a weaker parent verifies
  more, not less.
- Model-tier changes to `.claude/agents/*.md` require a scored run of the
  review eval (`docs/superpowers/evals/review-diff/`), not a judgment call.
```

- [ ] **Step 2:** `grep -n "Model continuity" AGENTS.md` — section present once, positioned between Model selection and Teams & nesting.

### Task 7: Phase 2 effect verification + commit

**Files:**
- Create: `docs/superpowers/evals/review-diff/results/2026-07-10-delta-mode.md`

**Interfaces:**
- Consumes: Task 4 baseline, Task 5 mode contract.

- [ ] **Step 1: Quality non-regression.** Re-run fx-01…fx-04 as full reviews (protocol unchanged). Every `found` from baseline must stay `found`; new misses = regression → fix the skill wording, re-run.
- [ ] **Step 2: Delta cost.** Run fx-05 in **delta mode** (dispatch prompt: `prior-report.md` verbatim + "delta: one edit to src/entities/user/index.ts"). Expect: the limit/message contradiction is found, no whole-project verification commands appear in the agent's tool use, tokens/time < the Task 4 fx-05 full-review numbers. Record both numbers side by side.
- [ ] **Step 3: Fallback check.** Run fx-05 delta dispatch WITHOUT the prior report attached. Expect: the agent states fallback to full mode in its report. Record.
- [ ] **Step 4:** `rm -f .claude/.review-stamp`. Then gate check: `git commit --allow-empty -m "gate probe"` → expect **blocked** by the pre-commit gate hook. (Do not keep any probe commit.)
- [ ] **Step 5:** Write the results file with the baseline-vs-delta table and fallback note.
- [ ] **Step 6: Phase 2 commit** (ask user; `code-reviewer` on the diff first):

```bash
git add .claude/skills/review-diff/SKILL.md AGENTS.md docs/superpowers/evals/review-diff/results/2026-07-10-delta-mode.md
git commit  # feat: review-diff にデルタ再レビューモードを追加し非Fable親の運用規則を明文化する (body: eval 結果の数値を引用; Co-Authored-By)
```

### Task 8: ADR + Aegis KB sync

**Files:**
- Create: `docs/adr/0014-measurement-first-model-continuity.md`
- Modify: `aegis-share/source/` (new document + edges mirroring the ADR)

- [ ] **Step 1:** Write ADR-0014 (English; repo ADR format: Status/Date/Context/Decision/Alternatives/Consequences). Content: the spec's three decisions in ADR form — (1) golden evals govern the review pipeline and model-tier changes; (2) `review-diff` gains a fail-closed delta re-review mode (amends ADR-0011's procedure, stamp semantics unchanged); (3) an on-demand `repo-audit` skill converts best-model judgment into existing artifact rails only (no third format; explicitly not scheduled). Alternatives: adopt shadcn/improve as-is (rejected: overlaps Aegis, third artifact format), no evals (rejected: model tiers stay vibes-based), build-first ordering (rejected: ADR-0011 code-graph lesson). Include the Phase 1/2 measured numbers in Consequences.
- [ ] **Step 2:** Mirror into aegis-share source + edges (edge hints: path `.claude/skills/review-diff/**`, path `docs/superpowers/evals/**`, command `review`), then:

```bash
npx -y @fuwasegu/aegis@1.7.0 share-format && npx -y @fuwasegu/aegis@1.7.0 share-lint && npx -y @fuwasegu/aegis@1.7.0 share-materialize && npx -y @fuwasegu/aegis@1.7.0 share-export
```

- [ ] **Step 3:** `npx -y @fuwasegu/aegis@1.7.0 doctor` → expect `Status: OK` (in_sync). Commit with Phase 2's commit or as an immediate follow-up docs commit (ask user).

---

## Phase 3 — `repo-audit` skill

### Task 9: Skill definition

**Files:**
- Create: `.claude/skills/repo-audit/SKILL.md`

- [ ] **Step 1:** Write the skill:

```markdown
---
name: repo-audit
description: On-demand repo-wide audit with the best available model — hunts what deterministic gates cannot (architecture drift vs ADRs, security posture, dependency strategy, doc staleness/DX) and routes outcomes into existing rails (ADR/AGENTS.md via aegis-share, or a plan doc in docs/superpowers/specs/). Use when the user asks for a repo audit / health check / "what should we improve"; not scheduled, not CI-run.
user_invocable: true
---

# Repo Audit

Best-model judgment, cheap-model legwork, existing artifact rails. The value
is the synthesis in the strongest available context — if the session model is
weak, say so and recommend re-running on a stronger one (AGENTS.md, Model
continuity).

## Lanes (only what gates cannot catch)

1. **architecture-drift** — code vs docs/adr/ decisions and AGENTS.md rules
2. **security-posture** — permissions, secrets handling, injection surfaces,
   supply chain (direct deps only, per ADR-0002)
3. **dependency-strategy** — staleness, dead deps, risky pins (not CVE lists —
   `bun audit` owns those)
4. **docs-dx** — stale/contradictory docs, onboarding friction, missing
   runbooks

Lint, types, tests, dead code, formatting are OUT of scope — hooks and CI
gates own them.

## Procedure

1. `aegis_compile_context` (or degraded path) with representative files per
   lane; the returned ADRs are the audit baseline.
2. Fan out one read-only Explore subagent per lane (`model: haiku`; `sonnet`
   when precision matters). Prompts must be self-contained and forbid edits.
3. Synthesize in the parent: keep only findings that are actionable and not
   already gate-covered; drop anything an existing ADR already decides
   (cite it instead).
4. Route every kept finding, never inventing a new format:
   - **Knowledge** (rule/convention/decision) → ADR draft or AGENTS.md edit →
     aegis-share flow (source + edges → format → lint → materialize → export).
   - **Work** (fix/build) → plan doc in `docs/superpowers/specs/` for a later
     `/start-workflow` execution.
5. Record at the end of the produced doc(s): date, model used, lanes run,
   total subagent tokens. If nothing new: report "nothing new" to the user
   and write NOTHING.

## Retention rule

If two consecutive audits produce nothing actionable, propose deleting this
skill (ADR-0011 code-graph lesson: measured-useless features are removed).
```

- [ ] **Step 2:** `head -8 .claude/skills/repo-audit/SKILL.md` — frontmatter valid (name, description, user_invocable).

### Task 10: One real audit run + Phase 3 commit

- [ ] **Step 1:** Run `/repo-audit` per the skill (best available model — currently Fable). One run, all four lanes.
- [ ] **Step 2:** Route outputs per the skill; verify: zero new document formats created (`git status` shows only ADR/AGENTS.md/aegis-share/specs paths — or nothing, if "nothing new").
- [ ] **Step 3:** Record cost (tokens per lane + synthesis) in the produced doc(s) or, if nothing new, report to the user.
- [ ] **Step 4:** Acceptance (spec Phase 3): ≥1 correctly-routed output or clean "nothing new". **Phase 3 commit** (ask user; `code-reviewer` first): `git add .claude/skills/repo-audit/ <routed outputs>` + commit (feat: 最良モデルの監査サイクルを既存レールに接続する).

---

## Self-review notes

- Spec coverage: Phase 1 → Tasks 1–4; Phase 2 (2a/2b + verification) → Tasks 5–7; ADR/KB (spec "Consequences", aegis-share memory) → Task 8; Phase 3 → Tasks 9–10. Out-of-scope items have no tasks (correct).
- fx-05 doubles as full-review fixture in Task 4 and delta fixture in Task 7 — intentional; the pair is the cost evidence.
- Commit gate interactions are explicit (stamp deletion after eval runs; gate probe in Task 7 Step 4).
