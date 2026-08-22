# Project Instructions

This project runs on **TanStack Start** on Cloudflare Workers — not Next.js. APIs and conventions may differ from your training data.

This file carries the directives. Step-by-step procedure for a named task lives in the skill it names — follow the pointer rather than assuming the summary is the whole rule.

## Workflow

Ticket-granularity work — implement a component, fix a non-trivial bug, refactor a module, add a feature — follows the `ticket-work` skill; invoke it at the start. Detect it yourself; the user does not announce it. A one-line fix, a single config value, or a docs-only change skips it — and when unsure which an edit is, invoke it.

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

## Language

**Use the plain word for what happens, in language the reader already has.** A vivid image, a shorthand, or a coined term is cheaper to write and reads as insight, but it substitutes an impression for the mechanism — and it sounds most confident exactly where it is least specific. Name the condition and the consequence separately, each with its own plain verb: "is not detected", "fails", "is skipped".

**When handing a decision back, state the goal, where it stands, what blocks it, and how the options differ — in that order.** The blocker is the one thing the reader cannot reconstruct alone, so it must be a fact rather than an impression.

This governs every text a person reads: replies, plans, reports, commit messages, PR descriptions, review comments, code comments. What such prose may take as its subject is settled by Code Practices; whether its claims are verified, by Knowledge Currency.

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

**Instruction documents.** Every document written for an agent (`.claude/`, AGENTS.md, CLAUDE.md) is in English. Point at other files, do not restate them — a copy is correct when written and wrong after the next edit to what it copied. An instruction to act is the exception: state the action. A pointer that makes the reader load a section, a step, or another document to recover one command drags in far more than the command. Never write a claim about another file, commit, tool, or count of any of them without opening or running it in the same turn; if that is not worth the cost, drop the assertive form instead. A grep only matches the literals you predicted, so never offer "expect zero hits" as proof. After changing a step, reconcile every other mention of what it names. The rule extends to the code in front of you, not only to other files: a comment may state what you have seen the code do, never what you meant it to do. "This ordering prevents X" and "a missing binary degrades to Y" are each one execution from proof, and both were written false here and caught by a reviewer before they shipped. Where a comment claims a check is load-bearing, delete the check and watch its test fail; that is the one form of this rule conviction cannot satisfy. Long enumerations rot; prefer a principle. All of this aims at procedures: An audit record describes decided state rather than action, so summarising one is not the restating this forbids.

## Testing

Tests are written against the implementation — test-first is not required. What is required is that every branch you added is reached by a test that fails when that branch breaks. White-box: tests cover internal logic paths and branches, not just inputs and outputs. Pure functions require 100% branch coverage, which `vitest.config.mts` enforces per file over an explicit module list — a new pure module joins that list when its test lands, or its coverage is silently no one's problem.

- **A test name states a condition and its result.** The name alone says what broke, without opening the body. Follow the phrasing of the tests around it.
- **One test, one `expect`, arranged as Arrange / Act / Assert.** A table-driven case is one test per row and obeys the same rule.
- **A structural result is asserted as one whole object.** Build what the unit produced — fields, a response's status and headers, whatever the shape is — and compare it with `toEqual` in a single `expect`. It fails with the whole shape, where field-by-field expects stop at the first mismatch and hide the rest.

Reaching a component's branches from a test depends on how the component was shaped; `.claude/rules/react.md` (Testable Behavior Extraction) governs that. Run `bun run test` yourself — nothing else runs the suite before CI.

## Commits & Pull Requests

- **One commit = one purpose.** If two changes could be reverted independently, split them — drive-by fixes are always a separate commit. Never `git add -A`/`git add .`; stage explicit paths, use `git add -p` to split hunks within a file.
- First line states **what improves**, not what you did. Prefixes: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` (intent-based). Body in Japanese; `fix`/`refactor` include a *why* line. End with a `Co-Authored-By:` trailer crediting the current model.
- Do not commit without explicit user confirmation.
- **Prose:** see Language. Commit-message specifics stay in the bullets above.
- **History:** while a PR is Draft, keep its commits clean (rebase freely). Once review has started, never rewrite reviewed commits — add fixes on top and integrate preserving the commit/review order (typically a merge commit).
