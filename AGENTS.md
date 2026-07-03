# Project Instructions

This project runs on **TanStack Start** on Cloudflare Workers (ADR-0007) — not Next.js. APIs and conventions may differ from your training data.

## Workflow

Ticket-granularity work (implement a component, fix a non-trivial bug, refactor a module, add a feature) MUST go through the `start-workflow` skill (ADR-0006). Interaction-complex features (wizards, auth/session flows, async guards, permission branching) additionally get a state-machine spec in `specs/` verified by the `verify-spec` workflow before implementation (ADR-0010).

## Design Philosophy

**Extensibility by default.** Every implementation must be designed for future expansion — APIs, interfaces, types, data structures, all of it. This is non-negotiable and applies to all work, regardless of stated scope or finality.

Today's best practice is tomorrow's anti-pattern. Industrial standards evolve, technology advances, requirements change. Code that can't accommodate growth gets rewritten from scratch. Design as if everything will change, because it will.

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
- **Before writing any import path or library/framework/SDK access pattern from memory, verify the current shape against official docs or source first** — how to read a binding, load config, register a handler, instantiate a client. These reshape between versions. Catching yourself thinking "I know how this works" or "you can only do it this way" is the cue to check, not to skip checking — that confident half-memory is the #1 source of silently-stale code

**Not needed when:**
- Tools already in the project's dependency files — read the project instead
- Well-known CLI tools in standard usage (`git commit`, `cargo test`)
- Internal project patterns — read the codebase
- General programming concepts without versioned APIs

**Don't present uncertain knowledge as fact.** If you're not sure something is correct — a term, a translation, a convention, a recommendation — verify it before writing it down. Plausible-sounding but invented information reads as authoritative and propagates through docs and code. When you can't verify, say so plainly instead of filling the gap with confidence.

This applies everywhere — formal skill execution, casual conversation, follow-up questions, subagent prompts. No exceptions for "I'm pretty sure." If you're about to state a specific version number, flag name, import path, API signature, translation, domain term, or behavioral detail from memory — stop and search.

## Code Practices

**Dead code first / phased execution:** Before structural refactors on files >300 LOC, remove dead code first (separate commit). Break multi-file refactors into phases of ≤5 files — complete, verify, get approval before each next phase.

**Senior dev standard:** Don't settle for "simplest approach" when architecture is flawed, state is duplicated, or patterns are inconsistent. Ask: "What would a perfectionist senior dev reject in code review?" Fix it.

**Verification before completion:** Never report done without running the project's type-checker and linter, fixing ALL errors. If none configured, state that explicitly.

**Never escape the type system to move on:** no `as` (except `as const`), `any`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, non-null `!`, or lint-disable comments to silence an error. Fix the type (narrowing, guards, schema validation, `satisfies`). If you genuinely can't, dispatch a subagent with the right skill; if it still fails, STOP and ask — never silently cast or suppress.

## Rules

Path-scoped rules are auto-loaded from `.claude/rules/`:

- **`.claude/rules/react.md`** (`**/*.tsx`) — Rules of React: purity, hooks, component splitting, module organization
- **`.claude/rules/design.md`** (`src/**/*.css`, `src/**/*.tsx`) — Design system: Wairo (和色) palette, squircle corners, typography, spacing, component conventions

## Rules of React

Follow the official Rules of React: https://ja.react.dev/reference/rules — components and hooks are pure, React calls them, hooks only at the top level.

## Testing

White-box testing: tests cover internal logic paths and branches, not just inputs/outputs. Pure functions require 100% branch coverage.

## Commits

- **One commit = one purpose.** If two changes could be reverted independently, split them — drive-by fixes are always a separate commit. Never `git add -A`/`git add .`; stage explicit paths, use `git add -p` to split hunks within a file.
- First line states **what improves**, not what you did. Prefixes: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` (intent-based). Body in Japanese; `fix`/`refactor` include a *why* line. End with a `Co-Authored-By:` trailer crediting the current model.
- Do not commit without explicit user confirmation.

## Agents

Write all agent-facing docs (`.claude/`, AGENTS.md, CLAUDE.md, `docs/adr/`) in English.

### Delegation

The parent session implements directly by default (ADR-0013). Delegate by **context impact, not task size**:

- **Parent edits directly**: normal implementation, fixes, integration, and post-review follow-ups — whenever the scope is understood. The per-edit lint/typecheck hook applies to parent edits.
- **Explore / research subagent**: bulk file reads, log digging, cross-cutting investigation whose raw output the parent won't reference again — only the summary should enter the parent's context.
- **Parallel implementation subagents**: multiple independent units with no shared files and no output dependency (multiple Agent calls in one message). Dependent units run sequentially — or stay in the parent. Never parallelize units that edit the same file.

Implementation dispatches run **foreground (synchronous)** — the parent waits and integrates. Background dispatch and SendMessage-based resumption are reserved for long-running independent research where mid-course correction is unnecessary. Briefings must be self-contained — goal, file paths, acceptance criteria, and the relevant guidelines quoted in (consult Aegis before every dispatch).

### Model selection — always set `model` explicitly

| Role | Model |
|---|---|
| Implementation / integration / planning (parent session) | session model — no dispatch needed |
| Exploration / search (Explore, scout) | `haiku` (`sonnet` when precision matters) |
| Parallel implementation units / research | `sonnet` |
| Code review — all `review-diff` lanes and direct `code-reviewer` dispatch | `sonnet` (re-run on `opus` only after a demonstrably weak result) |
| Long-horizon autonomous workers, complex migrations, escalation after a weak result | `opus` |

### Teams & nesting

- **Parallel subagent dispatch** is the default for independent fan-out — always cheaper and faster than a team when results only need to flow back to the parent.
- **Agent Teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, experimental): only when **peer dialogue itself is the value** — competing-hypothesis debugging (theories refute each other to converge), multi-perspective review where perspectives challenge each other, cross-layer work negotiating a shared API contract. 3–5 teammates; teammates never edit the same file; one team at a time; no `/resume` support, so avoid teams in sessions likely to be interrupted.
- **Nested subagents** (max depth 5): a dispatched worker may offload messy exploration (bulk searches, log digging) to a child scout and keep its own context clean — chiefly useful inside workers that own large parallel units. Models get cheaper with depth (worker `sonnet` → scout `haiku`). Default ceiling is depth 2 (parent → worker → scout); every extra level multiplies token cost, so justify deeper nesting explicitly. Never nest for sequential work — do it inline instead.

### Code Graph

`.claude/code-graph.json` is a statically-generated dependency graph of all `src/` files, produced by `bun run graph` (`scripts/build-graph.ts`). It maps each file's layer (`route` / `component` / `server` / `gateway` / `entity` / `lib`), its internal imports, and its reverse dependencies (`imported_by`). Both `review-diff` and `verify-spec` workflows inject the relevant subgraph into every subagent's prompt so agents can understand impact without independently exploring the codebase — this eliminates redundant file reads and reduces token consumption. A `PreToolUse(Bash)` hook regenerates the graph automatically when committing changes to `src/`.

### Review

Before every commit, run the unified review workflow `Workflow({name: "review-diff"})` on the uncommitted diff (ADR-0009; users invoke it as `/review-diff`, `{effort: "high"}` for a deeper pass). It combines bug-hunt finder lanes with the `code-reviewer` agent as the AGENTS.md rules lane, adversarially verifies every candidate, and stamps the commit gate on completion. This matters *more* under parent-centric implementation: fresh contexts that have not seen the implementation reasoning are the bias check. The parent fixes findings directly; re-review only after major rework. Handle findings: never dismiss as "pre-existing" when the file is in the diff; apply rules literally; when in doubt, fix. Reviewers must propose a concrete alternative with every finding, respect rule scope qualifiers, and not re-report dismissed findings. Fallback when the Workflow tool is unavailable: dispatch the `code-reviewer` agent directly (model comes from its agent definition) — include the rules content relevant to the changed files in the dispatch prompt; it stamps the gate too.

<!-- aegis:start -->
## Aegis Process Enforcement

You MUST consult Aegis for every coding-related interaction — implementation tasks AND questions about architecture, patterns, or conventions. No exceptions.

### When Writing Code

1. **Create a Plan** — Before touching any file, articulate what you intend to do.
2. **Tag catalog (recommended once per session)** — Call `aegis_get_known_tags` to list approved-resolvable tags and obtain `knowledge_version` and `tag_catalog_hash` for caching. Call again when the catalog hash changes.
3. **Consult Aegis** — Call `aegis_compile_context` with:
   - `target_files`: the files you plan to edit
   - `plan`: your natural-language plan (optional but recommended)
   - `command`: the type of operation (scaffold, refactor, review, etc.)
   - `intent_tags` (recommended): tags chosen from the step-2 catalog — drives `expanded` context deterministically. Use `[]` to skip expanded context without using the server-side SLM tagger. Omit `intent_tags` only if you want the server SLM tagger (when enabled) to infer tags from `plan` instead (see ADR-004).
4. **Read and follow** the returned architecture guidelines.
   - `delivery: "inline"` — content is included; read it directly.
   - `delivery: "deferred"` — content is NOT included. You MUST Read the file via `source_path` before proceeding. Prioritize by `relevance` score (high first); skip only documents with very low relevance (< 0.25) unless specifically needed.
   - `delivery: "omitted"` — excluded by budget or policy. Increase `max_inline_bytes` or use `content_mode: "always"` if needed.
5. **Self-Review** — After writing code, check your implementation against the returned guidelines.
6. **Report Compile Misses** — If Aegis failed to provide a needed guideline:
   ```
   aegis_observe({
     event_type: "compile_miss",
     related_compile_id: "<from compile_context>",
     related_snapshot_id: "<from compile_context>",
     payload: {
       target_files: ["<files>"],
       review_comment: "<what was missing or insufficient>",
       target_doc_id: "<optional: base.documents[*].doc_id whose content was insufficient>",
       missing_doc: "<optional: doc_id that should have been returned but was not>"
     }
   })
   ```
   - `target_doc_id`: A doc_id from the **base.documents** section of the compile result whose content was insufficient. Do NOT use expanded or template doc_ids.
   - `missing_doc`: A doc_id that should have been included in the compile result but was absent.
   - If neither can be identified, `review_comment` alone is sufficient.

### When Answering Questions

If the user asks about architecture, patterns, conventions, or how to write code — even without requesting implementation:

1. **Identify representative files** — Find 1–3 real file paths in the codebase that are relevant to the question (e.g. `modules/Member/Application/Member/UpdateMemberInteractor.php`). Use directory listings or search if needed. Do NOT guess paths or use directories. **Do NOT read the files** — Aegis already has the relevant guidelines; reading files wastes tokens.
2. **Consult Aegis** — Call `aegis_compile_context` with:
   - `target_files`: the real file paths from step 1
   - `plan`: the user's question in natural language
   - `command`: `"review"`
   - `intent_tags` (optional): when `expanded` context is useful, call `aegis_get_known_tags` first, then pass a subset of tags (or `[]` to skip expanded).
3. **Answer using Aegis context** — Base your answer on the guidelines returned by Aegis, supplemented by your own knowledge. Cite specific guidelines when relevant. When documents include a `relevance` score, prioritize high-scoring documents and skim or skip low-scoring ones.

### When Knowledge Base Is Empty

If `aegis_compile_context` returns no documents, the knowledge base has not been populated yet.
Ask the user to run initial setup using the **admin surface** with `aegis_import_doc` to add architecture documents with `edge_hints`.

### Rules

- NEVER skip the Aegis consultation step — for both implementation and questions.
- NEVER ignore guidelines returned by Aegis.
- The compile_id and snapshot_id from the consultation are required for observation reporting.
<!-- aegis:end -->
