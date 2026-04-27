---
name: start-workflow
description: Explicit entry point for ticket-granularity work (implement a component, fix a non-trivial bug, refactor a module, add a feature). The user invokes /start-workflow at the start of such tasks. The skill enforces an orchestration sequence — clarify → plan → optionally ADR → dispatch to subagent → review → commit/PR — so the parent session keeps a clean context and the work follows the project's rules-driven standards. Skip for one-line fixes, config tweaks, docs-only changes, and trivial typo fixes — handle those directly.
user_invocable: true
---

# Start Workflow

The orchestration entry point that turns a user request into a finished, reviewed, committable change without the parent session writing implementation code itself. Read this once at the beginning; do not re-read it per subtask.

## When this skill applies

**Apply** when the user asks for:

- A new component, page, or screen
- A bug fix that involves more than a one-line change
- A refactor across multiple files
- A new utility plus its tests
- An integration change (DB schema, API route, auth flow)

**Skip** (handle in the parent session directly) for:

- One-line fixes / typo corrections
- Config-only edits (`*.json`, `*.toml`, `.gitignore`, `package.json` field tweaks)
- Docs-only changes (`*.md`)
- Anything the user explicitly says "just do it quickly"

If unsure, lean toward applying — the cost of skipping orchestration on a borderline-non-trivial task is higher than the cost of using it on a borderline-trivial one.

## The sequence

### 1. Clarify

Read the user's request. If acceptance criteria or constraints are ambiguous, ask **at most one clarifying question** — focused on whichever ambiguity blocks dispatch the most. Do not bombard with a checklist.

If the request is clear enough, say so and proceed.

### 2. Compile context via aegis

Call `aegis_compile_context` with `target_files` (the files that will be edited or created) and `plan` (one-line goal). aegis returns the relevant rule and ADR documents deterministically, with relevance scores. Use this output as the single source of truth for "what rules apply to this task" — do not also paste in the full `@include` content; the rules are already in the prompt baseline.

For peripheral context that aegis doesn't carry — the colocated component nearest the target, existing patterns the change should mirror — note paths only (do not read the contents into the parent; the subagent will read them).

If aegis returns nothing relevant, that is itself a signal: either the knowledge base needs new docs (raise via `aegis_observe` with `event_type: "compile_miss"` after the work is done), or the task is genuinely outside any documented decision.

### 3. Decide on ADR

If the work involves a non-obvious design choice — picking between credible alternatives, introducing a new pattern, or reversing an earlier decision — note that an ADR is needed and draft it **before** dispatching the implementation. ADRs go in `docs/adr/` per the index there.

If the work is purely mechanical (no design call), skip the ADR.

### 4. Plan

Draft a short plan in the parent session before dispatch. The plan should include:

- One sentence on the goal
- Files to create or edit, with one-line description per file
- Acceptance criteria the subagent must satisfy
- Verification steps (`bun run typecheck` / `bun run test` / build / manual smoke test as applicable)

Keep the plan tight — it is the subagent briefing, not a design document. If the plan exceeds ~30 lines, break the work into smaller dispatches.

For genuinely complex multi-step work (≥ 5 distinct edits across unrelated areas, or work requiring TDD discipline), delegate the plan-writing itself to `superpowers:writing-plans` or use `superpowers:brainstorming` first. Per ADR-0006, superpowers' methodology skills are tools called from inside this orchestration — not parallel orchestrators. Do not let them auto-trigger as independent decision-makers.

### 5. Optional: worktree

If the change is large enough that you want isolation from the working tree (parallel branches, big refactor), create a git worktree before dispatch. For most ticket-granularity work this is overkill; default is to work on the current branch.

### 6. Dispatch

Hand the plan to a `general-purpose` subagent with `model: "sonnet"` (per `.claude/rules/agents.md`). The dispatch prompt must be self-contained — include the plan, file paths, rules to follow, and acceptance criteria. The subagent will not see the parent conversation.

Escalate the model to `opus` only if the task involves non-trivial design judgment that survived the planning stage, or if a previous `sonnet` dispatch returned low-quality output.

For tasks that decompose into clearly independent sub-tasks (e.g., "add three unrelated utility functions"), dispatch them in parallel via multiple `Agent` tool calls in a single message.

### 7. Review

Once the subagent returns:

- Read the diff (`git status` / `git diff`) — do not trust the summary alone
- Run `bun run typecheck` and `bun run test` — the existing PostToolUse hook already does this per-edit, but a final pass at the end catches gaps
- Verify the acceptance criteria from step 4 are met
- Apply the "Before reporting done" pass from `.claude/rules/agents.md` (test coverage on new branches, dead code / over-abstraction, null/off-by-one/async bug patterns)
- If something is wrong, dispatch a corrective subagent rather than fixing in the parent

### 8. Commit and PR

When the diff is correct, follow the existing `commit` and `pr` skills. Do not auto-commit unless the user explicitly asked for it earlier in the session.

## What this skill does not do

- It does not enforce TDD on every task. TDD is appropriate for pure functions and well-specified logic; it's overhead for UI assembly. Decide per-task.
- It does not invoke a separate "code review" agent. The parent reviews. If the work warrants a fresh-eyes review, dispatch one explicitly — don't bake it into the default flow.
- It does not assume Superpowers, aegis, or any external workflow framework is installed. If those are added later, this skill should be re-evaluated and likely deprecated in favor of the framework's equivalent.

## Anti-patterns

- **Skipping the plan step "because the task is obvious"**: if it's truly obvious it's probably trivial enough to skip the whole skill. If you need this skill, write the plan.
- **Pulling subagent results into the parent for "polish" edits**: the parent should not edit code. If the subagent's output needs polish, dispatch another subagent with corrective instructions.
- **Multiple parallel dispatches when tasks are coupled**: if subagent B depends on subagent A's output, run them sequentially. Parallel only for independent work.
- **Copying the plan into a commit message**: the plan is throwaway. Commit messages and ADRs are the durable record.
