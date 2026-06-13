---
name: start-workflow
description: Explicit entry point for ticket-granularity work (implement a component, fix a non-trivial bug, refactor a module, add a feature). The user invokes /start-workflow at the start of such tasks. The skill enforces an orchestration sequence — clarify → aegis → plan → optionally ADR → implement (parent by default, delegate by context impact) → fresh-context review → commit/PR — so the work follows the project's rules-driven standards. Skip for one-line fixes, config tweaks, docs-only changes, and trivial typo fixes — handle those directly.
user_invocable: true
---

# Start Workflow

The orchestration entry point that turns a user request into a finished, reviewed, committable change. The parent session implements directly by default and delegates by context impact (ADR-0013). Read this once at the beginning; do not re-read it per subtask.

## When this skill applies

**Apply** when the user asks for:

- A new component, page, or screen
- A bug fix that involves more than a one-line change
- A refactor across multiple files
- A new utility plus its tests
- An integration change (DB schema, API route, auth flow)

**Skip** (handle directly, no sequence) for:

- One-line fixes / typo corrections
- Config-only edits (`*.json`, `*.toml`, `.gitignore`, `package.json` field tweaks)
- Docs-only changes (`*.md`)
- Anything the user explicitly says "just do it quickly"

If unsure, lean toward applying — the cost of skipping orchestration on a borderline-non-trivial task is higher than the cost of using it on a borderline-trivial one.

## The sequence

### 1. Clarify

Read the user's request. If acceptance criteria or constraints are ambiguous, ask **at most one clarifying question** — focused on whichever ambiguity blocks the work the most. Prefer resolving ambiguity from the codebase or real data (files, assets, git history) before asking. Do not bombard with a checklist.

If the request is clear enough, say so and proceed.

### 2. Compile context via aegis

Call `aegis_compile_context` with `target_files` (the files that will be edited or created) and `plan` (one-line goal). aegis returns the relevant rule and ADR documents deterministically, with relevance scores. Use this output as the single source of truth for "what rules apply to this task" — do not also paste in the full rule content; the rules are already in the prompt baseline.

If aegis returns nothing relevant, that is itself a signal: either the knowledge base needs new docs (raise via `aegis_observe` with `event_type: "compile_miss"` after the work is done), or the task is genuinely outside any documented decision.

### 3. Decide on ADR

If the work involves a non-obvious design choice — picking between credible alternatives, introducing a new pattern, or reversing an earlier decision — draft the ADR **before** implementing. ADRs go in `docs/adr/` per the index there.

If the work is purely mechanical (no design call), skip the ADR.

### 4. Plan

Draft a short plan in the parent session. The plan should include:

- One sentence on the goal
- Files to create or edit, with one-line description per file
- Acceptance criteria
- Verification steps (`bun run typecheck` / `bun run test` / build / manual smoke test as applicable)

Keep the plan tight. For genuinely complex multi-step work (≥ 5 distinct edits across unrelated areas, or work requiring TDD discipline), delegate the plan-writing itself to `superpowers:writing-plans` or use `superpowers:brainstorming` first. Per ADR-0006, superpowers' methodology skills are tools called from inside this orchestration — not parallel orchestrators. Do not let them auto-trigger as independent decision-makers.

### 5. Implement

**The parent implements directly by default.** Use `superpowers:test-driven-development` for pure functions and well-specified logic. The per-edit lint/typecheck hook keeps quality continuous.

Delegate only when the delegation criteria (AGENTS.md / ADR-0013) are met:

- **Heavy exploration** (bulk file reads, log digging, cross-cutting investigation): dispatch an Explore/research subagent so the raw output never enters the parent's context — only the summary returns.
- **Independent parallel units** (no shared files, no output dependency): dispatch parallel `general-purpose` subagents (`model: "sonnet"`) via multiple Agent calls in one message. Dispatch prompts must be self-contained — plan, file paths, rules, acceptance criteria; the subagent will not see the parent conversation. Escalate to `opus` for non-trivial design judgment, after a weak `sonnet` result, or for long-horizon autonomous work.
- Implementation dispatches run **foreground (synchronous)** — wait and integrate. Do not rely on background dispatch + SendMessage resumption for implementation.

### 6. Review

Once implementation is complete:

- Read the full diff (`git status` / `git diff`) — for dispatched work, do not trust the summary alone
- Run `bun run typecheck` and `bun run test` — the PostToolUse hook already checks per-edit, but a final pass catches gaps
- Verify the acceptance criteria from step 4 are met
- **Dispatch the `code-reviewer` agent (`model: opus`) on the uncommitted diff.** This is the bias check: a fresh context that has not seen the implementation reasoning. Address every finding or explicitly justify it as out of scope before committing. A PreToolUse hook enforces this — `git commit` is blocked without a prior code-reviewer dispatch.
- **The parent fixes findings directly.** Re-review only after major rework.

### 7. Commit and PR

When the diff is correct, propose a commit split per the Commits discipline in AGENTS.md and ask the user for confirmation — never auto-commit. Create PRs with `gh pr create` (English summary) only when the user asks.

## What this skill does not do

- It does not enforce TDD on every task. TDD is appropriate for pure functions and well-specified logic; it's overhead for UI assembly. Decide per-task.
- It does not mandate delegation. Dispatch is a context-protection tool, not a quality ritual — the review step is the quality gate.

## Anti-patterns

- **Skipping the plan step "because the task is obvious"**: if it's truly obvious it's probably trivial enough to skip the whole skill. If you need this skill, write the plan.
- **Dispatching scoped work the parent could do directly**: briefing cost, summary-induced information loss, and round-trip latency buy nothing when the scope is already understood. Delegate for context protection, not by habit.
- **Letting exploration noise into the parent**: if an investigation will read many files or dump logs, that is exactly what Explore subagents are for — keep the parent's context for implementation and judgment.
- **Multiple parallel dispatches when tasks are coupled**: if unit B depends on unit A's output, run them sequentially — or just do both in the parent. Parallel only for independent work.
- **Copying the plan into a commit message**: the plan is throwaway. Commit messages and ADRs are the durable record.
