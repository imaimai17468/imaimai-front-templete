# Project Instructions

This project runs on **TanStack Start** on Cloudflare Workers — not Next.js. APIs and conventions may differ from your training data.

This file carries the directives. Step-by-step procedure for a named task lives in the skill it names — follow the pointer rather than assuming the summary is the whole rule.

## Workflow

This section is the single source of the process directives. Hooks only point back here — when a hook message and this document disagree, this document wins.

Ticket-granularity work — implement a component, fix a non-trivial bug, refactor a module, add a feature — follows the sequence below. Detect it yourself; the user does not announce it. Trivial edits (a one-line fix, a single config value, docs-only changes) skip it. If unsure which an edit is, follow the sequence: applying it to a borderline-trivial task costs less than skipping it on a borderline-non-trivial one.

Two things are **not** waived by that exemption, because they are disciplines rather than orchestration. Step 2's approval gate applies to any change that embeds a design choice, however few lines it is. Step 5's debugging rule applies to any change at all — a one-line bug fix is precisely where reproducing the failure before patching it matters most.

1. **Clarify.** If the acceptance criteria or constraints are ambiguous, resolve it from the codebase, the assets, or git history first. If that fails, ask **one** question — whichever ambiguity blocks the most work. Do not send a checklist.
2. **Judge the design.** Creative or architectural work — new UI, a new pattern, a choice between credible alternatives — is proposed with its alternatives and implemented only after the user approves. Presenting a design and starting in the same breath skips the gate.
3. **Plan.** One sentence of goal, the files to create or edit with one line each, the acceptance criteria, and the verification steps (`bun run typecheck` / `bun run check` / `bun run test` / build / manual smoke test, as applicable). Enter plan mode when the user asked for a plan.
4. **Spec the interaction, when it is complex.** Wizards and multi-step forms, auth or session flows, async guards, permission branching: write `specs/<feature>.spec.md` in the format the `verify-spec` skill defines and run `/verify-spec specs/<feature>.spec.md` before implementing. Fix the design for every CONFIRMED counterexample. The deciding factor is interaction complexity, not scale.
5. **Implement.** The parent implements directly by default — see Delegation for the exceptions. The tests that go with what you add follow Testing. When debugging, reproduce the failure and check what changed recently before forming a hypothesis, then test that hypothesis with the smallest possible change — never try changes to see which one sticks.
6. **Self-check.** Read the full diff. Run `bun run typecheck`, `bun run check` and `bun run test` — nothing checks your edits as you make them, and the Stop gate fires only at the end of the turn. Confirm the acceptance criteria from step 3 — and for anything a subagent implemented, read the diff itself rather than the subagent's summary.
7. **Review, then commit.** See Review. Propose the commit split and wait for the user.

## Degraded Environments

Not every session has the full toolchain — remote containers may lack MCP servers or local binaries. A missing tool downgrades a step; it never silently waives it, and it never blocks unrelated work. MUST-rules are satisfied by the corresponding degraded path below:

- **Gate binaries absent** (e.g. `similarity-ts`): the SessionStart env-check reports this. Treat a skipped check as "not run", never as "passed", and say so when reporting completion.

## Design Philosophy

**Extensibility by default.** Every implementation is designed for future expansion — APIs, interfaces, types, data structures, all of it. This applies to all work, regardless of stated scope or finality. Code that can't accommodate growth gets rewritten from scratch.

This is about structural choices at boundaries, not speculative features:

- **Do:** Use an enum where a boolean would suffice today — a third state is one requirement change away
- **Do:** Define a trait/interface at a module boundary, even with one implementation now
- **Do:** Structure data for additive changes — adding a field shouldn't break existing consumers
- **Don't:** Build features no one requested. Create abstractions for hypothetical use cases. Over-engineer.

This principle is silent — don't surface it, don't discuss it. Just apply it to every design decision.

## Knowledge Currency

Your training data goes stale. Outdated guidance is worse than no guidance.

**WebSearch is mandatory when:**

- Recommending a specific version, flag, or configuration
- Answering "how does X work" for tools with versions
- A user names a specific external tool or action and you're about to describe its behavior
- Suggesting a dependency or approach the user hasn't already chosen
- **Before writing any import path or library/framework/SDK access pattern from memory** — how to read a binding, load config, register a handler, instantiate a client. These reshape between versions. Catching yourself thinking "I know how this works" or "you can only do it this way" is the cue to check, not to skip checking — that confident half-memory is the #1 source of silently-stale code

**Not needed when:** the tool is already in the project's dependency files (read the project instead), it is a well-known CLI in standard usage (`git commit`, `cargo test`), the pattern is internal (read the codebase), or the concept has no versioned API.

**Don't present uncertain knowledge as fact.** If you're not sure something is correct — a term, a translation, a convention, a recommendation — verify it before writing it down. Plausible-sounding but invented information reads as authoritative and propagates through docs and code. When you can't verify, say so plainly. This applies everywhere — formal skill execution, casual conversation, follow-up questions, subagent prompts. No exception for "I'm pretty sure."

## Code Practices

**Dead code first / phased execution:** Before structural refactors on files >300 LOC, remove dead code first (separate commit). Break multi-file refactors into phases of ≤5 files — complete, verify, get approval before each next phase.

**Senior dev standard:** Don't settle for "simplest approach" when architecture is flawed, state is duplicated, or patterns are inconsistent. Ask: "What would a perfectionist senior dev reject in code review?" Fix it. Following the majority convention is an acceptable default, but when a better approach is known, take it.

**Comments explain the code directly below them — nothing else.** No narration, no supplements, no restating the obvious. If code needs a comment to be understood, strengthen the types or the structure until it doesn't; a comment is never the fix for unclear code. This holds for every comment you write — in code, in a PR description, in a review.

**A comment's subject never lives outside what it ships with.** An issue or PR number, "see above", another file's behavior, a decision reached in a past review — nothing checks any of these, so they go wrong the moment what they point at moves. Write what the reader needs where they are reading. One exemption, and it turns on who the reference is for: `Closes #123` in a PR body is consumed by the platform, which closes that issue when the PR merges, so it is machinery rather than a claim. `see #456` is addressed to the reader, who now has to leave and come back to understand you — that is the thing this bans. Whether a comment's claim is *true* is Instruction documents' subject, below.

**A comment is not a control mechanism.** Wanting to write one so that a future reader — or a future agent — does not do the wrong thing is the signal to change the structure or the types until the wrong thing does not compile. A warning binds only whoever reads it; a type binds everyone. Reach for the comment once the structural option is genuinely unavailable, not before.

**Generated types stay generated:** after any `wrangler.toml` change, run `bun run cf-typegen`. `worker-configuration.d.ts` is its output — never hand-edit it.

**Verification before completion:** Never report done without running the project's type-checker and linter, fixing ALL errors. If none configured, state that explicitly.

**Never escape the type system to move on:** no `as` (except `as const`), `any`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, non-null `!`, or lint-disable comments to silence an error. Fix the type (narrowing, guards, schema validation, `satisfies`). If you genuinely can't, dispatch a subagent with the right skill; if it still fails, STOP and ask — never silently cast or suppress.

## Rules

Rules are auto-loaded from `.claude/rules/`, and each is mirrored into `.cursor/rules/*.mdc` as a file-level symlink so Cursor sessions load the same text (never replace a symlink with a copy):

- **`react.md`** (`**/*.tsx`) — the official [Rules of React](https://ja.react.dev/reference/rules): purity, hooks at the top level, component splitting, module organization — project-independent principles only; this repository's concrete placements are in the paragraph below
- **`design.md`** (`src/**/*.css`, `src/**/*.tsx`) — design system: Wairo (和色) palette, squircle corners, typography, spacing, component conventions

`src/` is layered — `routes/` → `server/fn/` → `gateways/` → `entities/`, imports flow downward only, and `server/fn/` is the authorization boundary. The same contract fixes the placement homes: `src/components/` (`features/` for domain UI, `shared/<name>/` for cross-feature UI, `ui/` for shadcn CLI output — never rename `ui/`, `components.json` aliases resolve to it) and `src/lib/` for framework/infrastructure adapters and generic non-component values.

The next rule is not path-scoped — it applies whenever you write any instruction document, whatever the file type:

**Instruction documents.** Point at other files, do not restate them — a copy is correct when written and wrong after the next edit to what it copied. Never write a claim about another file, commit, tool, or count of any of them without opening or running it in the same turn; if that is not worth the cost, drop the assertive form instead. A grep only matches the literals you predicted, so never offer "expect zero hits" as proof. After changing a step, reconcile every other mention of what it names. The rule extends to the code in front of you, not only to other files: a comment may state what you have seen the code do, never what you meant it to do. "This ordering prevents X" and "a missing binary degrades to Y" are each one execution from proof, and both were written false here and caught by a reviewer before they shipped. Where a comment claims a check is load-bearing, delete the check and watch its test fail; that is the one form of this rule conviction cannot satisfy. Long enumerations rot; prefer a principle. All of this aims at procedures: An audit record describes decided state rather than action, so summarising one is not the restating this forbids.

## Testing

Tests are written against the implementation — test-first is not required. What is required is that every branch you added is reached by a test that fails when that branch breaks. White-box: tests cover internal logic paths and branches, not just inputs and outputs. Pure functions require 100% branch coverage, which `vitest.config.mts` enforces per file over an explicit module list — a new pure module joins that list when its test lands, or its coverage is silently no one's problem.

- **A test name states a condition and its result.** The name alone says what broke, without opening the body. Follow the phrasing of the tests around it.
- **One test, one `expect`, arranged as Arrange / Act / Assert.** A table-driven case is one test per row and obeys the same rule.
- **A structural result is asserted as one whole object.** Build what the unit produced — fields, a response's status and headers, whatever the shape is — and compare it with `toEqual` in a single `expect`. It fails with the whole shape, where field-by-field expects stop at the first mismatch and hide the rest.

Reaching a component's branches from a test depends on how the component was shaped; `.claude/rules/react.md` (Testable Behavior Extraction) governs that. No gate runs the suite before CI, so step 6's `bun run test` is the only thing between a broken test and a push.

## Commits & Pull Requests

- **One commit = one purpose.** If two changes could be reverted independently, split them — drive-by fixes are always a separate commit. Never `git add -A`/`git add .`; stage explicit paths, use `git add -p` to split hunks within a file.
- First line states **what improves**, not what you did. Prefixes: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` (intent-based). Body in Japanese; `fix`/`refactor` include a *why* line. End with a `Co-Authored-By:` trailer crediting the current model.
- Do not commit without explicit user confirmation.
- **Prose (PR descriptions, review comments, code comments): state only the core, plainly.** No decoration, no exhaustive detail. Write in general language the reader understands — never tool output, internal variable names, or domain/project-internal coinages. What such prose may take as its subject is settled by the comment rules in Code Practices.
- **History:** while a PR is Draft, keep its commits clean (rebase freely). Once review has started, never rewrite reviewed commits — add fixes on top and integrate preserving the commit/review order (typically a merge commit).

## Agents

Write all agent-facing docs (`.claude/`, AGENTS.md, CLAUDE.md) in English.

### Delegation

The parent session implements directly by default. Delegate by **context impact, not task size**:

- **Parent edits directly**: normal implementation, fixes, integration, and post-review follow-ups — whenever the scope is understood. There is no per-edit lint hook; checks run across `lefthook.yml`, `.claude/hooks/stop-gate.sh` and `.github/workflows/ci.yaml`. Open the relevant file before stating where a specific check runs — a wrong claim here was once cited by a review to confirm a gap that did not exist.
- **Explore / research subagent**: bulk file reads, log digging, cross-cutting investigation whose raw output the parent won't reference again — only the summary should enter the parent's context.
- **Parallel implementation subagents**: multiple independent units with no shared files and no output dependency (multiple Agent calls in one message). Dependent units run sequentially — or stay in the parent. Never parallelize units that edit the same file.

A sequential dispatch whose result the next step needs takes **`run_in_background: false`**. Subagents run in the background by default, so otherwise the parent's turn ends at the launch and the result arrives in a later turn rather than inside the one that asked for it — see `review-diff` step 0 for what has and has not been observed about whether the flag works here, the one place that observation is recorded. The parallel units above stay at the default. Fire-and-forget dispatch and SendMessage resumption are reserved for long-running independent research where mid-course correction is unnecessary.

Briefings must be self-contained — goal, file paths, acceptance criteria, and the relevant guidelines quoted in.

**Agent Teams** (experimental; opt in per session by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` yourself — deliberately not preset in `.claude/settings.json`) only when **peer dialogue itself is the value**: competing-hypothesis debugging, review perspectives that challenge each other, cross-layer API negotiation. 3–5 teammates, never editing the same file, one team at a time; no `/resume` support, so avoid them in interruptible sessions. **Nested subagents** (max depth 5) let a worker offload messy exploration to a child scout and keep its own context clean, models getting cheaper with depth (worker `sonnet` → scout `haiku`); the default ceiling is depth 2 and every extra level multiplies token cost, so justify deeper nesting explicitly. Never nest for sequential work — do it inline.

### Model selection — always set `model` explicitly

| Role | Model |
|---|---|
| Implementation / integration / planning (parent session) | session model — no dispatch needed |
| Exploration / search (Explore, scout) | `haiku` (`sonnet` when precision matters) |
| Parallel implementation units / research | `sonnet` |
| Code review — `code-reviewer` | `sonnet` (re-run on `opus` only after a demonstrably weak result) |
| Long-horizon autonomous workers, complex migrations, escalation after a weak result | `opus` |

`.claude/agents/*.md` carries each pinned agent's `permissionMode` and tool grants. Do not change either from memory — the mode lives in agent frontmatter rather than project settings deliberately, and any model-tier change requires a scored eval run against `scripts/evals/` first.

### Model continuity (non-Fable parent)

Review/verify quality is pinned by preloaded skills and deterministic gates and does not depend on the parent model — never re-derive or second-guess a pinned procedure. When the parent session runs on a weaker model than the strongest available (e.g. Opus instead of Fable), escalate **design judgment** — architecture choices, ambiguous trade-offs — to a subagent on the strongest available model, or stop and ask the user; mechanical implementation stays in the parent. Knowledge Currency applies with extra force: a weaker parent verifies more, not less.

### Review

Before every commit, review the uncommitted diff (users trigger it as `/review-diff`; pass `high` for a deeper multi-lens pass). The review is **one** dispatched agent the parent waits on: `code-reviewer` runs four ordered stages in its own context — find across all lenses (bugs + AGENTS.md + path-scoped rules), dedup, refute each candidate against the real code, return the survivors — and its completion stamps the commit gate. It is a depth-1 dispatch passed `run_in_background: false`. The `review-diff` skill pins that behavior; the parent's dispatch prompt is not pinned by it, and `review-diff` lists the slots it must fill.

**The review is one pass: find → verify → fix → done.** Each surviving finding arrives **with its fix and an acceptance check**; the parent applies those, saying so if it departs from one, and asks the user where a finding needs a decision. Applying them **keeps** the stamp: it records which paths the reviewer read, and a fix touches those same paths. Committing does not change the set either, so one review covers a multi-commit split. What the stamp does not cover is a path the review never saw — starting new work needs a new review, and the gate names the files.

**Do not edit while the dispatch is running.** The stamp is written when the agent finishes, so a path first touched mid-run is recorded as reviewed. Nothing enforces this one.

Handle findings: never dismiss as "pre-existing" when the file is in the diff; apply rules literally; when in doubt, fix. Findings must propose a concrete alternative, respect rule scope qualifiers, and not re-report dismissed findings.

Design-time verification of interaction-complex features uses the same single pinned-agent pattern (`/verify-spec specs/<feature>.spec.md`): `spec-verifier` formalizes the spec into a state machine, hunts counterexamples across all lenses, replays each against the machine, and returns the CONFIRMED survivors. Design-time only — no commit gate.
