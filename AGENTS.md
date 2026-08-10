# Project Instructions

This project runs on **TanStack Start** on Cloudflare Workers (ADR-0007) — not Next.js. APIs and conventions may differ from your training data.

This file carries directives. The reasoning behind them lives in the ADRs it cites, and step-by-step procedure lives in the skills it names (ADR-0030) — follow the pointer rather than assuming the summary is the whole rule.

## Workflow

This section is the single source of the process directives. Hooks only point back here — when a hook message and this document disagree, this document wins.

Ticket-granularity work (implement a component, fix a non-trivial bug, refactor a module, add a feature) MUST go through the `start-workflow` skill (ADR-0006). Detect this yourself — the user does not need to type `/start-workflow`. Interaction-complex features (wizards, auth/session flows, async guards, permission branching) additionally get a state-machine spec in `specs/` verified by the `verify-spec` workflow before implementation (ADR-0010).

Triggers that apply with or without start-workflow:

- **Planning / design requests**: use `superpowers:writing-plans` and enter plan mode before implementing.
- **Creative or architectural judgment** (new UI, architecture decisions, approach selection): run `superpowers:brainstorming` before any code change.
- **Any code change outside start-workflow**: consult Aegis first — the consultation contract is `.claude/rules/aegis.md`, loaded every session. When adding a pure function or presenter, use `superpowers:test-driven-development`.
- **Writing or amending an ADR**: use the `write-adr` skill. Records live only in `aegis-share/source/` (ADR-0021), and the share pipeline does not fire on hand edits — forgetting it leaves Aegis stale (`doctor` must report in_sync).

## Degraded Environments

Not every session has the full toolchain — remote containers may lack MCP servers, plugin skills, or local binaries. A missing tool downgrades a step; it never silently waives it, and it never blocks unrelated work. MUST-rules are satisfied by the corresponding degraded path below (the Aegis one lives with its MUST in `.claude/rules/aegis.md`):

- **superpowers skills absent**: carry out the step's intent manually — planning, brainstorming, and TDD are disciplines, not plugins — and note that the skill was unavailable.
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

**Comments explain the code directly below them — nothing else.** No narration, no supplements, no restating the obvious. If code needs a comment to be understood, strengthen the types or the structure until it doesn't; a comment is never the fix for unclear code.

**Verification before completion:** Never report done without running the project's type-checker and linter, fixing ALL errors. If none configured, state that explicitly.

**Never escape the type system to move on:** no `as` (except `as const`), `any`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, non-null `!`, or lint-disable comments to silence an error. Fix the type (narrowing, guards, schema validation, `satisfies`). If you genuinely can't, dispatch a subagent with the right skill; if it still fails, STOP and ask — never silently cast or suppress.

## Rules

Rules are auto-loaded from `.claude/rules/`, and each is mirrored into `.cursor/rules/*.mdc` as a file-level symlink so Cursor sessions load the same text (ADR-0031 — never replace a symlink with a copy):

- **`aegis.md`** (always applied) — the Aegis consultation contract: mandatory process enforcement, the degraded path when the MCP tools are absent, and the `deploy-adapters` warning
- **`react.md`** (`**/*.tsx`) — the official [Rules of React](https://ja.react.dev/reference/rules): purity, hooks at the top level, component splitting, module organization — project-independent principles only; this repository's concrete placements are in ADR-0016
- **`design.md`** (`src/**/*.css`, `src/**/*.tsx`) — design system: Wairo (和色) palette, squircle corners, typography, spacing, component conventions

`src/` is layered — `routes/` → `server/fn/` → `gateways/` → `entities/`, imports flow downward only, and `server/fn/` is the authorization boundary. The same contract fixes the placement homes: `src/components/` (`features/` for domain UI, `shared/<name>/` for cross-feature UI, `ui/` for shadcn CLI output — never rename `ui/`, `components.json` aliases resolve to it) and `src/lib/` for framework/infrastructure adapters and generic non-component values. The contract is ADR-0016; Aegis serves it for any `src/**` edit.

The next rule is not path-scoped — it applies whenever you write any instruction document, whatever the file type:

**Instruction documents.** Point at other files, do not restate them — a copy is correct when written and wrong after the next edit to what it copied (ADR-0030). Never write a claim about another file, commit, tool, or count of any of them without opening or running it in the same turn; if that is not worth the cost, drop the assertive form instead. A grep only matches the literals you predicted, so never offer "expect zero hits" as proof. After changing a step, reconcile every other mention of what it names. The rule extends to the code in front of you, not only to other files: a comment may state what you have seen the code do, never what you meant it to do. "This ordering prevents X" and "a missing binary degrades to Y" are each one execution from proof, and both were written false here and caught by a reviewer before they shipped. Where a comment claims a check is load-bearing, delete the check and watch its test fail; that is the one form of this rule conviction cannot satisfy. Long enumerations rot; prefer a principle. All of this aims at procedures: ADRs and audit records describe decided state rather than action, so summarising one is not the restating this forbids.

## Testing

White-box testing: tests cover internal logic paths and branches, not just inputs/outputs. Pure functions require 100% branch coverage.

## Commits & Pull Requests

- **One commit = one purpose.** If two changes could be reverted independently, split them — drive-by fixes are always a separate commit. Never `git add -A`/`git add .`; stage explicit paths, use `git add -p` to split hunks within a file.
- First line states **what improves**, not what you did. Prefixes: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` (intent-based). Body in Japanese; `fix`/`refactor` include a *why* line. End with a `Co-Authored-By:` trailer crediting the current model.
- Do not commit without explicit user confirmation.
- **Prose (PR descriptions, review comments, code comments): state only the core, plainly.** No decoration, no exhaustive detail. Write in general language the reader understands — never tool output, internal variable names, or domain/project-internal coinages.
- **History:** while a PR is Draft, keep its commits clean (rebase freely). Once review has started, never rewrite reviewed commits — add fixes on top and integrate preserving the commit/review order (typically a merge commit).

## Agents

Write all agent-facing docs (`.claude/`, AGENTS.md, CLAUDE.md, `aegis-share/source/documents/`) in English.

### Delegation

The parent session implements directly by default (ADR-0012). Delegate by **context impact, not task size**:

- **Parent edits directly**: normal implementation, fixes, integration, and post-review follow-ups — whenever the scope is understood. There is no per-edit lint hook (ADR-0025); checks run across `lefthook.yml`, `.claude/hooks/stop-gate.sh` and `.github/workflows/ci.yaml`. Open the relevant file before stating where a specific check runs — a wrong claim here was once cited by a review to confirm a gap that did not exist.
- **Explore / research subagent**: bulk file reads, log digging, cross-cutting investigation whose raw output the parent won't reference again — only the summary should enter the parent's context.
- **Parallel implementation subagents**: multiple independent units with no shared files and no output dependency (multiple Agent calls in one message). Dependent units run sequentially — or stay in the parent. Never parallelize units that edit the same file.

A sequential dispatch whose result the next step needs takes **`run_in_background: false`**. Subagents run in the background by default, so otherwise the parent's turn ends at the launch and the result arrives in a later turn rather than inside the one that asked for it — see `review-diff` step 0 for what has and has not been observed about whether the flag works here, the one place that observation is recorded. The parallel units above stay at the default. Fire-and-forget dispatch and SendMessage resumption are reserved for long-running independent research where mid-course correction is unnecessary.

Briefings must be self-contained — goal, file paths, acceptance criteria, and the relevant guidelines quoted in. Consult Aegis before every dispatch.

**Agent Teams** (experimental; opt in per session by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` yourself — deliberately not preset in `.claude/settings.json`) only when **peer dialogue itself is the value**: competing-hypothesis debugging, review perspectives that challenge each other, cross-layer API negotiation. 3–5 teammates, never editing the same file, one team at a time; no `/resume` support, so avoid them in interruptible sessions. **Nested subagents** (max depth 5) let a worker offload messy exploration to a child scout and keep its own context clean, models getting cheaper with depth (worker `sonnet` → scout `haiku`); the default ceiling is depth 2 and every extra level multiplies token cost, so justify deeper nesting explicitly. Never nest for sequential work — do it inline.

### Model selection — always set `model` explicitly

| Role | Model |
|---|---|
| Implementation / integration / planning (parent session) | session model — no dispatch needed |
| Exploration / search (Explore, scout) | `haiku` (`sonnet` when precision matters) |
| Parallel implementation units / research | `sonnet` |
| Code review — `code-reviewer` | `sonnet` (re-run on `opus` only after a demonstrably weak result) |
| Long-horizon autonomous workers, complex migrations, escalation after a weak result | `opus` |

`.claude/agents/*.md` carries each pinned agent's `permissionMode` and tool grants. Do not change either from memory: ADR-0004 holds why the mode is set in agent frontmatter rather than project settings and what `auto` does and does not relax, and ADR-0014 requires a scored eval run against `scripts/evals/` before any model-tier change. Aegis serves both for a `.claude/agents/**` edit.

### Model continuity (non-Fable parent)

Review/verify quality is pinned by preloaded skills and deterministic gates (ADR-0011/0013) and does not depend on the parent model — never re-derive or second-guess a pinned procedure. When the parent session runs on a weaker model than the strongest available (e.g. Opus instead of Fable), escalate **design judgment** — architecture choices, ADR drafting, ambiguous trade-offs — to a subagent on the strongest available model, or stop and ask the user; mechanical implementation stays in the parent. Knowledge Currency applies with extra force: a weaker parent verifies more, not less.

### Review

Before every commit, review the uncommitted diff (users trigger it as `/review-diff`; pass `high` for a deeper multi-lens pass). The review is **one** dispatched agent the parent waits on (ADR-0029): `code-reviewer` runs four ordered stages in its own context — find across all lenses (bugs + AGENTS.md + path-scoped rules), dedup, refute each candidate against the real code, return the survivors — and its completion stamps the commit gate. It is a depth-1 dispatch passed `run_in_background: false`. The `review-diff` skill pins that behavior; the parent's dispatch prompt is not pinned by it, and `review-diff` lists the slots it must fill.

**The review is one pass: find → verify → fix → done** (ADR-0019). Each surviving finding arrives **with its fix and an acceptance check** (ADR-0020); the parent applies those, saying so if it departs from one, and asks the user where a finding needs a decision. Fixing does not trigger another review — the stamp survives those edits. There is no re-review step and no partial re-run mode. **Do not edit while the dispatch is running**: the stamp is not bound to a tree, so a mid-run edit earns a stamp for code the agent never read.

Handle findings: never dismiss as "pre-existing" when the file is in the diff; apply rules literally; when in doubt, fix. Findings must propose a concrete alternative, respect rule scope qualifiers, and not re-report dismissed findings.

Design-time verification of interaction-complex features uses the same single pinned-agent pattern (`/verify-spec specs/<feature>.spec.md`, ADR-0029): `spec-verifier` formalizes the spec into a state machine, hunts counterexamples across all lenses, replays each against the machine, and returns the CONFIRMED survivors. Design-time only — no commit gate.

## Aegis

The Aegis consultation contract — when to consult, the consultation steps, the degraded path, and the `deploy-adapters` warning — is `.claude/rules/aegis.md`, an always-applied rule loaded every session (ADR-0031). It binds exactly as if it were printed here.
