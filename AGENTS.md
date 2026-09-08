# Project Instructions

This project runs on **TanStack Start** on Cloudflare Workers. Its APIs and conventions may differ from your training data, and reading it as Next.js is the specific error that follows.

This file carries the directives. Step-by-step procedure for a named task lives in the skill it names. Follow the pointer rather than assuming the summary is the whole rule.

## Workflow

Ticket-granularity work follows the `ticket-work` skill: implementing a component, fixing a non-trivial bug, refactoring a module, adding a feature, where a ticket is what the next paragraph defines. Invoke it at the start, and detect the case yourself, because the user does not announce it. A one-line fix, a single config value, or a docs-only change skips it, and a change stays docs-only across the document, the `.cursor/rules/` symlink mirroring it, and the Rules list below. Where an edit could be either, invoke it.

**A request becomes tickets before anyone codes.** A ticket is the smallest change that leaves `main`'s CI green when it merges alone, in any order with the other tickets, and that one worker can carry to a merged PR in one session. Split a request by that test, top to bottom through `routes/` → `server/fn/` → `gateways/` → `entities/`, because knip fails an export nothing consumes, so a layer on its own never passes. Two pieces of which either fails that test when merged alone are one ticket, and so are two that edit the same files, because their PRs would conflict. A piece only one ticket needs stays inside that ticket. A piece that two or more tickets need, such as a new entity, is the first ticket, and the tickets that need it are dispatched after it merges. A PR is one ticket with every commit it needs, opened once the decision behind it is settled.

**Dispatch when the split yields two or more tickets.** The session that received the request resolves the ambiguities that change the split (ticket-work's Clarify step, with the user when present), splits, dispatches one `general-purpose` worker per ticket (a docs-only ticket included), runs the watch in Commits & Pull Requests, and reports the run's PRs once it prints `all-closed`. Each worker is the parent that `ticket-work` describes and carries the remaining ambiguities as assumptions in its PR body. A request that yields one ticket is done in the session with `ticket-work`. A request whose tickets cannot be settled yet, because the design between them is open, is one ticket until the design is decided.

**Parallel tickets each get their own worktree.** Start a session with `claude --worktree <name>`, or give a subagent `isolation: worktree`. Either way Claude Code creates the worktree under `.claude/worktrees/` on its own branch and copies the gitignored files listed in `.worktreeinclude` into it. In a fresh worktree, run `mise trust`, because `mise exec` refuses an untrusted `mise.toml` and the pre-push actionlint step runs through it. Then run `bun install`, `bun run generate-routes` and `bun run cf-typegen` before `bun run check` or `bun run test`, because the checkout has no `node_modules`, `src/routeTree.gen.ts` or `worker-configuration.d.ts`. That `bun install` also syncs lefthook into the `.git/hooks` every worktree shares with the main checkout. That write is part of the setup, so keep it. Before the first `bun run dev` there, run `bun run db:push:local`, because the local D1 under `.wrangler/state` starts empty. `bun run dev` runs through portless, which assigns the dev server a free port and the URL `https://<last segment of the branch name>.my-app.localhost` (no prefix on `main`, and two branches that share a last segment share a URL), and Better Auth takes its base URL from the request, so login redirects return to that URL. Google accepts a redirect URI only on a public-suffix TLD or on `localhost` itself, so check Google login with `PORTLESS=0 bun run dev`, which serves `http://localhost:5173` without the proxy in one checkout at a time. Everything short of Google login is checkable on any worktree's URL.

## Degraded Environments

Not every session has the full toolchain, and a remote container may lack MCP servers or local binaries. A missing tool downgrades a step. It never waives that step, and it never blocks unrelated work. Report a step the session could not run as "not run", never as "passed", and name it when reporting completion. The SessionStart env-check reports an absent gate binary such as `similarity-ts`.

## Design Philosophy

**Extensibility by default.** Every implementation is designed for future expansion: APIs, interfaces, types, data structures. This applies to all work, regardless of stated scope or finality. Code that cannot accommodate growth gets rewritten from scratch.

This governs structural choices at boundaries:

- **Do:** Use an enum where a boolean would suffice today, because a third state is one requirement change away
- **Do:** Define a trait/interface at a module boundary, even with one implementation now
- **Do:** Structure data for additive changes, so adding a field does not break existing consumers
- **Don't:** Build a feature no one requested, or an abstraction for a hypothetical use case

This principle is silent. Do not surface it or discuss it, and apply it to every design decision.

## Knowledge Currency

Your training data goes stale. Outdated guidance is worse than no guidance.

**WebSearch is mandatory when:**

- Recommending a specific version, flag, or configuration
- Answering "how does X work" for tools with versions
- A user names a specific external tool or action and you're about to describe its behavior
- Suggesting a dependency or approach the user hasn't already chosen
- **Before writing any import path or library/framework/SDK access pattern from memory**, such as how to read a binding, load config, register a handler, or instantiate a client. These reshape between versions. Catching yourself thinking "I know how this works" or "you can only do it this way" is the cue to check rather than to skip checking, because that confident half-memory is how silently-stale code gets written

**Not needed when:** the project already pins the version and shows the usage you need (read the project instead), it is a well-known CLI in standard usage (`git commit`, `cargo test`), the pattern is internal (read the codebase), or the concept has no versioned API.

**Don't present uncertain knowledge as fact.** Verify a term, a translation, a convention, or a recommendation before writing it down. Plausible-sounding but invented information reads as authoritative and propagates through docs and code. Where you cannot verify, say so plainly. This applies to formal skill execution, casual conversation, follow-up questions, and subagent prompts alike, with no exception for "I'm pretty sure."

## Code Practices

**Dead code first / phased execution:** Before structural refactors on files >300 LOC, remove dead code first (separate commit). Break multi-file refactors into phases of ≤5 files. Each phase is its own PR, and the next phase starts after that PR merges.

**Senior dev standard:** Don't settle for "simplest approach" when architecture is flawed, state is duplicated, or patterns are inconsistent. Ask: "What would a perfectionist senior dev reject in code review?" Fix it. Following the majority convention is an acceptable default, but when a better approach is known, take it.

**Comments explain the code directly below them and nothing else.** No narration, no supplements, no restating the obvious. Where code needs a comment to be understood, change the name, the types, or the structure until it does not, because a comment is never the fix for unclear code. A request for a clarifying comment, from the user or from a reviewer, asks for the code to be understood, so answer it by changing one of those three and report which you changed. This holds for every comment you write, in code, in a PR description, and in a review.

**A comment's subject never lives outside what it ships with.** Nothing checks an issue or PR number, a "see above", another file's behavior, or a decision reached in a past review, so each goes wrong the moment what it points at moves. Write what the reader needs where they are reading. One exemption turns on who the reference is for. The platform consumes `Closes #123` in a PR body and closes that issue when the PR merges, so it is machinery rather than a claim. `see #456` addresses the reader, who now has to leave and come back to understand you, and that is what this bans. Whether a comment's claim is *true* is Instruction documents' subject, below.

**A comment is not a control mechanism.** Wanting to write one so that a future reader or a future agent does not do the wrong thing is the signal to change the structure or the types until the wrong thing does not compile. A warning binds only whoever reads it, where a type binds everyone. Reach for the comment once the structural option is genuinely unavailable.

**Generated types stay generated:** after any `wrangler.toml` change, run `bun run cf-typegen`. That command writes `worker-configuration.d.ts`, so never hand-edit it.

**Verification before completion:** Never report done without running `bun run check` and `bun run test`, fixing every error. `check` is `vp check`, which formats, lints and type-checks in one pass. A change touching no code skips both. `knip` and `similarity-ts` judge the whole tree rather than your diff, and CI and the pre-push hook run them.

**Never escape the type system to move on:** no `as` (except `as const`), `any`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, non-null `!`, or lint-disable comments to silence an error. Fix the type (narrowing, guards, schema validation, `satisfies`). Where you genuinely cannot, dispatch a subagent with the right skill. Where that still fails, leave the PR in Draft with a comment naming the type that will not resolve and report it, and never silently cast or suppress.

## Rules

Rules are auto-loaded from `.claude/rules/`, and each is mirrored into `.cursor/rules/*.mdc` as a file-level symlink so Cursor sessions load the same text (never replace a symlink with a copy). Each rule's own frontmatter states its subject and its scope, and it states the scope twice because Claude Code reads `paths` and Cursor reads `globs`, so both keys change together.

- **`react.md`** names the concrete `src/components/` homes in its Module Organization section, so `.tsx` placement is settled there rather than here.
- **`prose.md`** has no path scope, so it binds this reply as much as anything committed.

A principle lives in this file. A concrete of this repository, such as a path, a file name, or a command, lives in the rule whose scope covers the files it names, and the part of it a scope would hide from a session that needs it stays here.

`src/` is layered as `routes/` → `server/fn/` → `gateways/` → `entities/`, imports flow downward only, and `server/fn/` is the authorization boundary. `src/lib/` holds framework/infrastructure adapters and non-component values a second consumer reads, and `src/components/` holds UI. A value read by one component lives beside that component.

The next rule has no path scope, and applies whenever you write any instruction document, whatever the file type:

**Instruction documents.** Every document written for an agent (`.claude/`, AGENTS.md, CLAUDE.md) is in English. Point at other files rather than restating them, because a copy is correct when written and wrong after the next edit to what it copied. An instruction to act is the exception: state the action. A pointer that makes the reader load a section, a step, or another document to recover one command drags in far more than the command. Never write a claim about another file, commit, tool, or count of any of them without opening or running it in the same turn. Where that is not worth the cost, drop the assertive form instead. A grep only matches the literals you predicted, so never offer "expect zero hits" as proof. After changing a step, reconcile every other mention of what it names. The rule reaches the code in front of you as well: a comment may state what you have seen the code do, never what you meant it to do. "This ordering prevents X" and "a missing binary degrades to Y" are each one execution from proof, and a reviewer caught both written false here before they shipped. Where a comment claims a check is load-bearing, delete the check and watch its test fail, which is the one form of this rule that conviction cannot satisfy. Long enumerations rot, so prefer a principle. All of this aims at procedures. An audit record describes decided state rather than action, so summarising one is not the restating this forbids.

**Guidance carries no padding.** A rule, a plan, or any instruction about how to act is written as well as it can be written, and then nothing is added: no restated rationale, no second example teaching what the first taught, no new section or file for something an existing one holds. Brevity is never the aim and is never bought with precision. Cut what repeats, and keep what decides.

**Write a rule as the move to make.** Where the user asks for a rule that removes a behavior, state the action that replaces it, because a prohibition leaves every other route open and makes the reader invent the replacement. Where no action replaces the behavior, the prohibition is the whole rule and stands as one.

**Nothing an agent learns goes into its auto-memory.** A memory binds only the agent that happens to recall it and is read by no reviewer, so what would be saved there is put where the next agent meets it: this file or a rule for a judgment, the skill for a procedure, the structure or the types for a constraint.

## Testing

Tests are written against the implementation, and test-first is not required. What is required is that every branch you added is reached by a test that fails when that branch breaks. White-box: tests cover internal logic paths and branches as well as inputs and outputs. Pure functions require 100% branch coverage, which `vitest.config.mts` enforces per file over an explicit module list. A new module whose exports are all pure joins that list when its test lands, or nothing gates its coverage and no one notices. A module that reaches I/O stays out of it, and so does a component.

- **A test name states a condition and its result.** The name alone says what broke, without opening the body. Follow the phrasing of the tests around it.
- **One test, one `expect`, arranged as Arrange / Act / Assert.** A table-driven case is one test per row and obeys the same rule.
- **A structural result is asserted as one whole object.** Build what the unit produced, whether that is a set of fields or a response's status and headers, and compare it with `toStrictEqual` in a single `expect`. It fails with the whole shape, where field-by-field expects stop at the first mismatch and hide the rest.

Reaching a component's branches from a test depends on how the component was shaped, and `.claude/rules/react.md` (Testable Behavior Extraction) governs that. Run `bun run test` yourself, because nothing else runs the suite before CI.

## Commits & Pull Requests

- **One commit = one purpose.** Where two changes could be reverted independently, split them, and a drive-by fix is always its own commit. One review finding is one commit, so a round that raised four findings lands four commits. Never `git add -A` or `git add .`. Stage explicit paths, and use `git add -p` to split hunks within a file.
- First line states **what improves**, not what you did. Prefixes: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` (intent-based). Body in Japanese, and `fix`/`refactor` include a *why* line. End with a `Co-Authored-By:` trailer crediting the current model.
- **A commit message names the defect it fixes.** `レビュー指摘の修正` and `#123 対応` send the reader to the review thread to learn what changed. Write the wrong behavior and the behavior that replaced it.
- **Commit and push freely on a PR branch, with or without the user present.** `main` takes changes only through a PR, so on `main` create a branch before the first commit.
- **A PR's author holds it until it merges, and no repository setting is involved.** Open it with `gh pr create --draft` after the first commit; once `bun run check` and `bun run test` pass on the branch, mark it ready and poll `gh pr checks --json name,bucket` in an `until` loop with `sleep`, inside one Bash call, until the CI `build` check is `pass` (`--watch` also waits on third-party checks, and one that never reports holds it forever; a background watch ends your turn before the check reports). When `gh pr view --json mergeStateStatus` says `BEHIND`, run `gh pr update-branch` and poll again, so the check ran on the merged result. Then `gh pr merge --squash` and `git push origin --delete <branch>`; `--delete-branch` checks `main` out locally and fails in a worktree, because the main checkout already has it. Development infrastructure (`wrangler.toml`, migrations, auth, local D1 and R2) is the worker's to change like any other code; production is the user's, so `bun run deploy`, `wrangler secret put`, and `bun run db:push` against the remote D1 wait for them.
- **Dispatch workers against measured memory, not a fixed count.** On this template a worker peaks near 4 GB (a Claude Code session 0.7 GB, `bun run check` 1.4 GB, a dev server 2 GB, measured 2026-09-07 on macOS). Before each dispatch run `bun scripts/orchestrate.ts free-gib` and dispatch only while the GiB it prints stays above 4 per worker that will be running after this dispatch, plus 8 for the machine; a worker that finishes frees its share, so run it again before the next dispatch.
- **The dispatching session runs only what `.claude/settings.json` allowlists.** A permission prompt in the session that dispatched the workers stops every further dispatch until a person answers it, where a prompt in a worker stops that worker alone. So that session keeps to `Agent` and the three commands of `scripts/orchestrate.ts`, which that file allowlists, and ad-hoc `git`, `gh`, and file edits belong to workers, the conflict worker below included. Watch the run with `bun scripts/orchestrate.ts watch-prs <number>...` naming the run's PRs, as a Bash call with `run_in_background`, so a message from the user reaches the session while it waits. The watch reads each PR once a minute and exits with one line: `conflict <number>...` when an open PR of the run turns CONFLICTING, `all-closed` once none is open, and `gh-failed <message>` when `gh` itself failed, in which case fix what the message names and start the watch again. Its exit re-invokes the session, and the line is in the task's output file. The watch reports the state it finds each time it runs, so start it again when that file holds no line. `run_in_background` belongs to this session alone. A PR's own author waits in the foreground. On `conflict`, dispatch one worker per named PR with `isolation: worktree` that removes the finished worker's worktree if that worktree still holds the PR's branch (`git worktree remove`), fetches and checks the branch out in its own worktree, resolves it as below, and holds the PR from there as its author; then start the watch again. A worktree with uncommitted changes is left in place and reported instead of removed. Merging stays with each PR's author. On `all-closed`, run `bun scripts/orchestrate.ts clean-worktrees <number>...` with the same numbers, which removes each of the run's worktrees whose pull request is finished and whose commits GitHub holds, deletes that branch and the `worktree-agent-` branch Claude Code left behind it, and prints why it kept the others.
- **Resolve a conflict by rebasing onto main.** `git fetch origin && git rebase origin/main`, resolve, run `bun run check` and `bun run test`, then `git push --force-with-lease` to the PR's own branch and no other. A PR no person has reviewed counts as Draft for the History rule below, so the rebase is allowed.
- **Prose:** see `.claude/rules/prose.md`. Commit-message specifics stay in the bullets above.
- **History:** while a PR is Draft, keep its commits clean (rebase freely). Once review has started, never rewrite reviewed commits. Add fixes on top, and integrate preserving the commit/review order, typically with a merge commit.
- **Answer every review comment in its thread.** Name the change you made, or the reason none was needed. Where you judge the finding wrong, the user decides: give them the problem the reviewer found, the change the reviewer asked for, and your reason for refusing, so they can decide without reading the thread.
