# Project Instructions

This project runs on **TanStack Start** on Cloudflare Workers. Its APIs and conventions may differ from your training data, and reading it as Next.js is the specific error that follows.

## Workflow

Ticket-granularity work follows the `ticket-work` skill, whose description names the cases. Detect them yourself, because the user does not announce them, and where an edit could be either, invoke it. A change to this document or to the rules under `.claude/hooks/guidance/` counts as docs-only.

**A request of more than one ticket is split, phased and dispatched as `ticket-work`'s *Tickets and waves* section says**, so invoke `ticket-work` before splitting or dispatching, even where each ticket alone would skip it.

**Browser tools.** Confirm a rendered change and debug a page with Claude in Chrome, falling back to Chrome DevTools MCP where it is not connected or refused, and report the step "not run" where neither is available; a Cursor session uses Cursor's browser. Go straight to Chrome DevTools MCP for what Claude in Chrome lacks (Lighthouse, performance traces, heap snapshots, `emulate`, an isolated cookie context) and to watch a `requestAnimationFrame` loop, opening it with `new_page` without `background`, because a Claude in Chrome tab can report `hidden` and run no frames. Keep this order even when the plugin's `chrome-devtools` skill matches. Claude in Chrome drives the user's one Chrome: call `tabs_context_mcp`, work only in a tab you opened with `tabs_create_mcp`, close it with `tabs_close_mcp`, and never trigger an `alert`, `confirm` or `prompt`, which blocks the extension until the user dismisses it.

## Degraded Environments

Not every session has the full toolchain, and a remote container may lack MCP servers or local binaries. A missing tool downgrades a step. It never waives that step, and it never blocks unrelated work. Report a step the session could not run as "not run", never as "passed", and name it when reporting completion.

`permissions.defaultMode` in `~/.claude/settings.json` or in managed settings decides the permission mode (an interactive session with none set starts in auto mode), never this repository's `.claude/settings*.json`. Under auto mode a classifier decides each action in place of the user, in a dispatched worker as in the session that dispatched it (https://code.claude.com/docs/en/permission-modes and https://code.claude.com/docs/en/auto-mode-config). A `soft_deny` rule is cleared only by the user's own message naming the action it gates, and a dispatching session's prompt to a worker is not that message, so settle such an action with the user before dispatching and quote their words to each worker. `claude auto-mode defaults --label '<name>'` prints the three this repository's work meets. Self-Modification gates adding a permission, loosening a hook, or writing consent the user did not give under `.claude/` or in `CLAUDE.md`, and exempts a content edit the user asked for. Merge Without Review gates merging before a human approved. Git Destructive names the force push and remote-branch deletion that Commits & Pull Requests directs. An allow rule resolves before the classifier, and `.claude/settings.json` allowlists `Bash(gh pr merge --squash *)`, so the merge in the form `ticket-work` step 7 writes never reaches Merge Without Review.

Two guards refuse a Bash command by its text rather than prompting, and each refusal names what to change: `.claude/hooks/pre-bash-guard/pre-bash-guard.sh`, and in a worktree-isolated session a guard that refuses a command it cannot show stays inside the worktree (`ticket-work`'s opening paragraph records the forms it has passed and refused). Write the words out as literals, and send a refused command's parts one per Bash call.

## Design Philosophy

**Extensibility by default.** Every implementation is designed for future expansion: APIs, interfaces, types, data structures. A scope stated as "just this once" does not exempt a change from it.

- **Do:** Use an enum where a boolean would suffice today, because a third state is one requirement change away
- **Do:** Define a trait/interface at a module boundary, even with one implementation now
- **Don't:** Build a feature no one requested, or an abstraction for a hypothetical use case

This principle is silent. Do not surface it or discuss it.

## Knowledge Currency

**Search before writing or answering from memory** a version, a flag, a configuration, an import path or a library access pattern (reading a binding, loading config, registering a handler, instantiating a client), how a versioned tool or an external tool or service the user names behaves, or a dependency or approach the user has not chosen. Thinking "I know how this works" is the cue. Where the project pins the version and already shows the usage, or the pattern is internal, read the project instead; a well-known CLI in standard use needs neither.

**One authoritative source ends a lookup.** The official documentation, the specification, or the library's own source settles it. Search for a claim you are about to write, never re-query a fact this session has answered, and stop near four lookups, writing what you could not confirm into the sentence it limits.

**Effect ships its own guidance, and it outranks a search.** Before writing any Effect code, read `node_modules/effect/AGENTS.md` completely and follow the links it names. For an API or a concept that guide leaves out, search `node_modules/effect/src`, which is the pinned version's own source. That guide tells you to avoid other copies of Effect's documentation, and most of them predate the v4 this project pins.

## Code Practices

**Decide what the work needs and act on it.** A finding you can act on is a change to make, and a default a careful engineer would choose is yours to set. Hand back only what the user alone can weigh (their taste, their tools, their tolerance for risk), anything touching production or money, and a boundary that needs their own words, which Degraded Environments names. Hand it back with `AskUserQuestion`, one question per decision. Where more than one is open, hand back the one blocking the most work and hold the rest until it is answered. A report states what you decided and why, and carries no question of its own.

**Check the instructed means against the purpose.** Where a means other than the one the user named would change the choice on effect, cost, safety, or feasibility, hand back the alternative and its tradeoff before acting. Keep the constraints they stated and the authority they granted; a change to the purpose, the scope, or a bounding constraint waits for confirmation, and a small reversible improvement inside the request does not. A dispatched worker takes the means it recommends and records the others in the pull request body.

**Comments explain the code directly below them and nothing else.** No narration and no restating the obvious. Where code needs a comment to be understood, change the name, the types, or the structure until it does not, and answer a request for a clarifying comment the same way, reporting which you changed. A comment never points outside what it ships with (an issue or PR number, "see above", another file's behavior, a past review's decision), because nothing keeps the pointer true; `Closes #123` in a PR body is machinery the platform consumes and stays. Wanting a comment to stop a future reader doing the wrong thing is the signal to change the structure or the types until the wrong thing does not compile, and to write the comment only where neither can. These hold in code, in a PR description, and in a review, except that a PR description or a review names earlier work as *Name a PR or an issue by the work it carries* says, so the pointer rule binds code comments alone.

**Format with `bun run format:fix`.** `bun run check:fix` also runs the lint fixer, whose `unicorn/throw-new-error` fix inserts `new` into the `extends` clause of a class extending `Schema.TaggedError<T>()("Tag", {})`, and the result raises TS7009. The oxlint override that exempts the gateway modules, and the reason for it, are in `vite.config.ts`.

**A binding comes from Void, and nothing under `src/` restates its type.** Void binds `DB` because a module imports `void/db` and `STORAGE` because one imports `void/storage`. A binding no such import covers is declared under `cloudflare` in `void.config.ts`, and a secret the Worker reads is declared in `env.ts` and read through `env` from `void/env`. `bun run generate-void` writes their types into `.void/`, which `tsconfig.json` extends.

**Verification before completion:** The Stop gate runs `bun run check` (typecheck, lint, format and the Effect diagnostics `tsconfig.json` configures) where the turn changed code, a stylesheet or a JSON file, so run `bun run test` yourself where the turn changed code. CI adds checks the gate does not run, unfiltered by which files your diff touched, and what they find is yours to fix: `bun run test`, `bun run dead-code`, `bun run dupes` (pre-push runs it too), `bun run build`, which runs the build `void deploy` runs without deploying, `bun run smoke`, which boots the dev server on an empty local D1 and R2 and requests the routes `scripts/smoke/smoke.ts` names (run it where a change could reach a request), and `bun scripts/claude-frontmatter/check-claude-frontmatter.entry.ts` (run it after editing anything under `.claude/`, which the Stop gate passes and CI then fails). No gate reads rendered text beyond smoke's one marker string, so where a change alters what a page renders, run `bun run dev` and read the route at the URL it prints.

**Browser support is Baseline Widely available.** Use a Widely available feature without a fallback, and give any other feature the fallback its `modern-web-guidance` guide names.

**Never escape the type system to move on.** No `as` under `src/`, `any`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, non-null `!`, or a lint-disable comment to silence an error; lint reports all of them but a `@ts-expect-error` that carries a description. Fix the type (narrowing, guards, schema validation, `satisfies`). Where you cannot, dispatch a subagent with the right skill, and where that fails, leave the PR in Draft with a comment naming the type that will not resolve and report it, never casting or suppressing silently.

## Rules

Rules live in `.claude/hooks/guidance/`, and nothing loads them at launch: `.claude/hooks/scoped-guidance/scoped-guidance.sh` tells a session to Read one when it touches what the rule's frontmatter `paths`, `commands` or `events` name, so a new rule needs no edit to the hook. A Cursor session is told of none of them and opens the one its work needs itself. Two scopes hide a rule from a session that needs it, so open these yourself: `design.md` (`src/**/*.css`, `src/**/*.tsx`) when deciding a UI question before opening such a file, and `prose.md` (`.md` files and publishing commands) when drafting a code comment or a reply. `replies.md` governs the reply to the user alone, and decides a sentence of a reply that `prose.md` also reaches. Where a module or a non-component value goes is settled in `react.md`'s Module Organization rather than here.

A principle lives in this file. A concrete of this repository, such as a path, a file name, or a command, lives in the rule whose scope covers the files it names, and the part of it a scope would hide from a session that needs it stays here. A step-by-step procedure for a named task lives in the skill that names it, and a constraint lives in the structure or the types.

A file's layer is the innermost role directory on its path: `components/`, `gateway/` or `entities/`, spelled with a leading `-` inside `src/routes/` so the route generator skips them. `src/shared/ui/` is the component layer too, being the one path `components.json` writes shadcn output to. A route file is one under `src/routes/` in none of those, and `src/lib/` holds the platform adapters. Imports flow route and component → gateway → entities, a `gateway/` directory is the authorization boundary, and `src/lib/` is read by the three above it and reads entities alone. `src/routes/` carries the URL space alone, and what two or more routes use lives in `src/shared/`.

**Nothing an agent learns goes into its auto-memory.** A memory binds only the agent that happens to recall it and is read by no reviewer. Put what would be saved there where the next agent meets it, which this section's placement rule decides.

## Testing

Every branch you added is reached by a test that fails when that branch breaks, covering internal paths as well as inputs and outputs; test-first is not required. `vitest.config.mts` enforces 100% branch coverage per file. A module that only wires a real dependency passes by holding no branch of its own, with the seam a test substitutes settled per layer (`.claude/hooks/guidance/data-fetching.md` for a service), and a file run as a command is named `*.entry.ts`, which coverage excludes by suffix. The hooks under `.claude/hooks/` carry no tests.

## Commits & Pull Requests

- **One commit = one purpose.** Where two changes could be reverted independently, split them, and a drive-by fix is always its own commit. One review finding is one commit, so a round that raised four findings lands four commits. Never `git add -A`, `git add .`, or `git commit -a`. Stage explicit paths, and use `git add -p` to split hunks within a file.
- First line states **what improves**, not what you did. Prefixes: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` (intent-based). Body in Japanese, and `fix`/`refactor` include a *why* line. End with a `Co-Authored-By:` trailer crediting the current model.
- **Commit and push freely on a PR branch, with or without the user present.** `main` takes changes only through a PR, so on `main` create a branch before the first commit.
- **A PR's author holds it until it merges, and no repository setting is involved.** It is Draft from the first commit, ready once `bun run check` and `bun run test` pass on the branch, and merged once the CI `build` check passes on the merged result, after which its remote branch is deleted. `ticket-work` step 7 carries the commands. Development infrastructure (`void.config.ts`, `env.ts`, migrations, auth, the local D1 and R2 that `bun run dev` runs) is the worker's to change like any other code; production is the user's. The model runs only the `void` commands Void's docs (`node_modules/void/docs/reference/cli/`) describe as local: `prepare`, `db generate`, `db migrate`, `db reset`, `db studio` and `db execute` without `--remote`, `env check` without `--remote`, and `env types`. `bun run deploy` and every other `void` command wait for the user. The `prod-logs` skill carries the steps from a log the user fetched to a local reproduction.
- **The dispatching session runs only what `.claude/settings.json` allowlists while its workers are in flight.** `dispatch-run`'s *Watching the run* says why, and which work that leaves to workers.
- **Force-push only to the PR's own branch and no other**, when resolving a conflict as `ticket-work`'s *Resolve a conflict by rebasing onto main* says.
- **History:** while a PR is Draft, keep its commits clean (rebase freely). Once review has started, never rewrite reviewed commits. Add fixes on top, so the PR keeps each review finding next to the commit that answered it, and merge it with the squash `ticket-work` step 7 runs.
- **Answer every review comment in its thread.** Name the change you made, or the reason none was needed. Where you judge the finding wrong, the user decides: give them the problem the reviewer found, the change the reviewer asked for, and your reason for refusing, so they can decide without reading the thread.
- **Name a PR or an issue by the work it carries**, such as `TanStack Query への移行` rather than `#264` alone, and link the PR rather than a commit SHA, because the PR holds the reason for the change.
