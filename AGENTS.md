# Project Instructions

This project runs on **TanStack Start** on Cloudflare Workers. Its APIs and conventions may differ from your training data, and reading it as Next.js is the specific error that follows.

This file carries the directives, and the Rules section settles which document holds what. Follow the pointer rather than assuming the summary is the whole rule.

## Workflow

Ticket-granularity work follows the `ticket-work` skill: implementing a component, fixing a non-trivial bug, refactoring a module, adding a feature, where a ticket is what the next paragraph defines. Invoke it at the start, and detect the case yourself, because the user does not announce it. A one-line fix, a single config value, or a docs-only change skips it, and a change stays docs-only across the document, the `.cursor/rules/` symlink mirroring it, and the Rules list below. Where an edit could be either, invoke it.

**A request becomes tickets before anyone codes.** A ticket is the smallest change that leaves `main`'s CI green when it merges alone, in any order with the other tickets, and that one worker can carry to a merged PR in one session. Split a request by that test, top to bottom through the layer order the Rules section below names, because knip fails an export nothing consumes, so a layer on its own never passes. Two pieces of which either fails that test when merged alone are one ticket, and so are two that edit the same files, because their PRs would conflict. A piece only one ticket needs stays inside that ticket. A piece that two or more tickets need, such as a new entity, is the first ticket, and the tickets that need it are dispatched after it merges. A PR is one ticket with every commit it needs, opened once the decision behind it is settled.

**Dispatch when the split yields two or more tickets.** The session that received the request resolves the ambiguities that change the split (ticket-work's Clarify step, with the user when present), splits, dispatches one `general-purpose` worker per ticket (a docs-only ticket included), naming the `dispatch-run` skill in each worker's prompt, runs that skill itself, and reports the run's PRs once its watch says every one of them is closed. A worker whose ticket invokes `ticket-work` is the parent that skill describes, and a docs-only worker follows `dispatch-run`'s Worker brief instead. A request that yields one ticket is done in the session with `ticket-work`. A request whose tickets cannot be settled yet, because the design between them is open, is one ticket until the design is decided.

**Parallel tickets each get their own worktree.** Start a session with `claude --worktree <name>`, or give a subagent `isolation: worktree`. Either way Claude Code creates the worktree under `.claude/worktrees/` on its own branch and copies the gitignored files listed in `.worktreeinclude` into it. `ticket-work`'s opening paragraph says what it still lacks and which commands put those there.

## Degraded Environments

Not every session has the full toolchain, and a remote container may lack MCP servers or local binaries. A missing tool downgrades a step. It never waives that step, and it never blocks unrelated work. Report a step the session could not run as "not run", never as "passed", and name it when reporting completion.

The session's permission mode also changes how a step runs. Read `~/.claude/settings.json` to learn it, because `permissions.defaultMode: "auto"` and the classifier's `autoMode` block take effect from that file alone and never from this repository's `.claude/settings*.json`. How auto mode decides an action (a classifier in place of the user, in a dispatched worker as in the session that dispatched it; a refusal returned as a reason to try something else; the pause after 3 refusals in a row or 20 in a session; `permissions.ask` still prompting; writes under `.claude/`, except `.claude/worktrees`, and to `lefthook.yml` reaching the classifier whatever `permissions.allow` holds) is documented at https://code.claude.com/docs/en/permission-modes and https://code.claude.com/docs/en/auto-mode-config, read 2026-09-09. What follows from it here:

- A `soft_deny` rule is cleared only by the user's own message naming the specific action it gates, and a dispatching session's prompt to a worker is not that message, so settle such an action with the user before dispatching and quote their words to each worker. `claude auto-mode defaults --label 'Self-Modification'` and `--label 'Merge Without Review'` print two such rules this repository's work meets: widening the agent's own config under `.claude/` or `CLAUDE.md`, and merging a pull request before a human has approved it. `--label 'Git Destructive'` prints a third, whose text names force pushes and remote-branch deletion, both of which Commits & Pull Requests directs.
- This project's `ask` list is empty.
- Claude Code resolves a narrow Bash allow rule before the classifier runs, and `.claude/settings.json` allowlists `Bash(gh pr merge --squash *)`, so the merge step Commits & Pull Requests gives each PR's author resolves there and never reaches the Merge Without Review rule. The prefix matches from the start of the command, so `--squash` goes right after `merge` and the number after `--squash`; `--merge`, `--rebase`, `--admin`, or the number before `--squash` reaches the classifier instead.

Two guards read a Bash command's text before the command runs, and each refuses it rather than prompting. `.claude/hooks/pre-bash-guard.sh` refuses a command that names a protected env file, a `find` whose root reaches the whole repository or that runs a command or deletes per match, and a `git add`, `git stage`, `git rm` or `git commit` whose operands take files nobody named; its refusal says which operand took more than it named, so name the paths and run it again. A worktree-isolated session meets a second guard, which refuses a command it cannot show stays inside that worktree, and names the worktree to run the plain command from: a value another program acts on, text naming `git` fed to another program, and a chain of commands it called too complex to check were each refused on 2026-09-09. Write the words out as literals and send one command per Bash call.

## Design Philosophy

**Extensibility by default.** Every implementation is designed for future expansion: APIs, interfaces, types, data structures. This applies to all work, regardless of stated scope or finality. Code that cannot accommodate growth gets rewritten from scratch.

- **Do:** Use an enum where a boolean would suffice today, because a third state is one requirement change away
- **Do:** Define a trait/interface at a module boundary, even with one implementation now
- **Don't:** Build a feature no one requested, or an abstraction for a hypothetical use case

This principle is silent. Do not surface it or discuss it.

## Knowledge Currency

Your training data goes stale. Outdated guidance is worse than no guidance.

**WebSearch is mandatory when:**

- Recommending a specific version, flag, or configuration
- Answering "how does X work" for tools with versions
- A user names a specific external tool or action and you're about to describe its behavior
- Suggesting a dependency or approach the user hasn't already chosen
- **Before writing any import path or library/framework/SDK access pattern from memory**, such as how to read a binding, load config, register a handler, or instantiate a client. These reshape between versions. Catching yourself thinking "I know how this works" or "you can only do it this way" is the cue to check

**Not needed when:** the project already pins the version and shows the usage you need (read the project instead), it is a well-known CLI in standard usage (`git commit`, `cargo test`), the pattern is internal (read the codebase), or the concept has no versioned API.

**Don't present uncertain knowledge as fact.** Verify a term, a translation, a convention, or a recommendation before writing it down. Plausible-sounding but invented information reads as authoritative and propagates through docs and code. Where you cannot verify, say so plainly. This applies to formal skill execution, casual conversation, follow-up questions, and subagent prompts alike, with no exception for "I'm pretty sure."

## Code Practices

**Dead code first / phased execution:** Before structural refactors on files >300 LOC, remove dead code first (separate commit). Break multi-file refactors into phases of ≤5 files. Each phase is its own PR, and the next phase starts after that PR merges.

**Senior dev standard:** Don't settle for "simplest approach" when architecture is flawed, state is duplicated, or patterns are inconsistent. Ask: "What would a perfectionist senior dev reject in code review?" Fix it. Following the majority convention is an acceptable default, but when a better approach is known, take it.

**Decide what the work needs and act on it.** A finding you can act on is a change to make, and a default a careful engineer would choose is yours to set. What stays with the user is an option whose cost only they can weigh, such as their taste, the tools they work in, or their tolerance for risk, anything touching production or money, and a boundary whose crossing needs their own words, which Degraded Environments names above. Hand one of those back with `AskUserQuestion`, the harness's multiple-choice dialog, one question per decision and the option you recommend first. Where more than one is open, hand back the one that blocks the most work and hold the rest until it is answered. A report states what you decided and why, and carries no question of its own.

**Comments explain the code directly below them and nothing else.** No narration, no supplements, no restating the obvious. Where code needs a comment to be understood, change the name, the types, or the structure until it does not, because a comment is never the fix for unclear code. A request for a clarifying comment, from the user or from a reviewer, asks for the code to be understood, so answer it by changing one of those three and report which you changed. This holds for every comment you write, in code, in a PR description, and in a review.

**A comment's subject never lives outside what it ships with.** Nothing checks an issue or PR number, a "see above", another file's behavior, or a decision reached in a past review, so each goes wrong the moment what it points at moves. Write what the reader needs where they are reading. One exemption turns on who the reference is for. The platform consumes `Closes #123` in a PR body and closes that issue when the PR merges, so it is machinery rather than a claim. `see #456` addresses the reader, who now has to leave and come back to understand you, and that is what this bans. Whether a comment's claim is *true* is Instruction documents' subject, below.

**A comment is not a control mechanism.** Wanting to write one so that a future reader or a future agent does not do the wrong thing is the signal to change the structure or the types until the wrong thing does not compile. A warning binds only whoever reads it, where a type binds everyone. Reach for the comment once the structural option is genuinely unavailable.

**Generated types stay generated:** after any `wrangler.toml` change, run `bun run cf-typegen`. That command writes `worker-configuration.d.ts`, so never hand-edit it.

**Verification before completion:** The Stop gate (`.claude/hooks/stop-gate.sh`) runs `bun run check` and `bun run test` where the turn changed a code or stylesheet file, and `bun .claude/hooks/check-md-links.ts` over the whole repository where it changed anything at all. It runs neither `knip` nor `similarity-ts`, because both judge more than your diff: CI runs `knip` on every pull request, and lefthook's pre-push runs `similarity-ts` over `src/` where that binary is on PATH, skipping the step where it is not. Neither is filtered by which files your change touched, and what either finds is yours to fix.

**Never escape the type system to move on:** no `as` (except `as const`), `any`, `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck`, non-null `!`, or lint-disable comments to silence an error. Fix the type (narrowing, guards, schema validation, `satisfies`). Where you genuinely cannot, dispatch a subagent with the right skill. Where that still fails, leave the PR in Draft with a comment naming the type that will not resolve and report it, and never silently cast or suppress.

## Rules

Rules are auto-loaded from `.claude/rules/`, and each is mirrored into `.cursor/rules/*.mdc` as a file-level symlink so Cursor sessions load the same text (never replace a symlink with a copy). Each rule's own frontmatter states its subject and its scope, and it states the scope twice because Claude Code reads `paths` and Cursor reads `globs`, so both keys change together.

- **`design.md`** is scoped to `src/**/*.css` and `src/**/*.tsx`, so a session deciding a UI question without opening one of those files loads none of it and has to open the rule itself.
- **`prose.md`** carries no path scope, so every session holds it whatever it is editing.
- **`react.md`** names the concrete `src/components/` and `src/lib/` homes in its Module Organization section, so where a module or a non-component value goes is settled there rather than here.

A principle lives in this file. A concrete of this repository, such as a path, a file name, or a command, lives in the rule whose scope covers the files it names, and the part of it a scope would hide from a session that needs it stays here. A step-by-step procedure for a named task lives in the skill that names it, and a constraint lives in the structure or the types.

`src/` is layered as `routes/` → `server/fn/` → `gateways/` → `entities/`, imports flow downward only, and `server/fn/` is the authorization boundary.

**Instruction documents.** Every document written for an agent (`.claude/`, AGENTS.md, CLAUDE.md) is in English. Point at other files rather than restating them, because a copy is correct when written and wrong after the next edit to what it copied. An instruction to act is the exception: state the action. A pointer that makes the reader load a section, a step, or another document to recover one command drags in far more than the command. Never write a claim about another file, commit, tool, or count of any of them without opening or running it in the same turn. Where that is not worth the cost, drop the assertive form instead. A grep only matches the literals you predicted, so never offer "expect zero hits" as proof. After changing a step, reconcile every other mention of what it names. The rule reaches the code in front of you as well: a comment may state what you have seen the code do, never what you meant it to do. "This ordering prevents X" is one execution from proof. Where a comment claims a check is load-bearing, delete the check and watch its test fail, which is the one form of this rule that conviction cannot satisfy. Long enumerations rot, so prefer a principle. All of this aims at procedures. An audit record describes decided state rather than action, so summarising one is not the restating this forbids.

**Guidance carries no padding.** A rule, a plan, or any instruction about how to act takes no new section and no new file for something an existing one holds, and `prose.md`'s *Write one claim once* settles the repetition inside a passage. Brevity is never the aim and is never bought with precision.

**Write a rule as the move to make.** Where the user asks for a rule that removes a behavior, state the action that replaces it, because a prohibition leaves every other route open and makes the reader invent the replacement. Where no action replaces the behavior, the prohibition is the whole rule and stands as one.

**Nothing an agent learns goes into its auto-memory.** A memory binds only the agent that happens to recall it and is read by no reviewer. Put what would be saved there where the next agent meets it, which this section's placement rule decides.

## Testing

Tests are written against the implementation, and test-first is not required. What is required is that every branch you added is reached by a test that fails when that branch breaks. White-box: tests cover internal logic paths and branches as well as inputs and outputs. Pure functions require 100% branch coverage, which `vitest.config.mts` enforces per file, and a module is inside that gate with no config edit. A module that only wires a real dependency into logic tested elsewhere is named `*.live.ts`, and a file run as a command is named `*.entry.ts`. That file's `coverage.exclude` matches both by suffix, and matches components and generated files by theirs. A plain path stays in that array where something else owns the name, such as a file route whose name is its URL, or a script that a permission allowlist names by path. A new module of either kind fails the suite naming its own path until it is renamed, as long as it holds a branch, because `branches` is the only threshold that file sets.

- **A test name states a condition and its result.** The name alone says what broke, without opening the body. Follow the phrasing of the tests around it.
- **One test, one `expect`, arranged as Arrange / Act / Assert.** A table-driven case is one test per row and obeys the same rule.
- **A structural result is asserted as one whole object.** Build what the unit produced, whether that is a set of fields or a response's status and headers, and compare it with `toStrictEqual` in a single `expect`. It fails with the whole shape, where field-by-field expects stop at the first mismatch and hide the rest.

Reaching a component's branches from a test depends on how the component was shaped, and `.claude/rules/react.md` (Testable Behavior Extraction) governs that.

## Commits & Pull Requests

- **One commit = one purpose.** Where two changes could be reverted independently, split them, and a drive-by fix is always its own commit. One review finding is one commit, so a round that raised four findings lands four commits. Never `git add -A`, `git add .`, or `git commit -a`. Stage explicit paths, and use `git add -p` to split hunks within a file.
- First line states **what improves**, not what you did. Prefixes: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` (intent-based). Body in Japanese, and `fix`/`refactor` include a *why* line. End with a `Co-Authored-By:` trailer crediting the current model.
- **A commit message names the defect it fixes.** `レビュー指摘の修正` and `#123 対応` send the reader to the review thread to learn what changed. Write the wrong behavior and the behavior that replaced it.
- **Commit and push freely on a PR branch, with or without the user present.** `main` takes changes only through a PR, so on `main` create a branch before the first commit.
- **A PR's author holds it until it merges, and no repository setting is involved.** It is Draft from the first commit, ready once `bun run check` and `bun run test` pass on the branch, and merged once the CI `build` check passes on the merged result, after which its remote branch is deleted. `ticket-work` step 7 carries the commands. Development infrastructure (`wrangler.toml`, migrations, auth, local D1 and R2) is the worker's to change like any other code; production is the user's, so `bun run deploy`, `wrangler secret put`, and `bun run db:push` against the remote D1 wait for them.
- **Bound the dispatch count by free memory and by what the account's usage windows have left.** On this template a worker peaks near 4 GB (a Claude Code session, `bun run check` and a dev server together, measured 2026-09-07 on macOS), and cores do not bind before the memory does. Before each dispatch run `bun scripts/orchestrate.ts free-gib` and dispatch only while the GiB it prints stays above 4 per worker that will be running after this dispatch, plus 8 for the machine; a worker that finishes frees its share, so run it again before the next dispatch. The GiB number says nothing about tokens. The account signs in through claude.ai (`claude auth status`), whose five-hour and seven-day windows accumulate what every session and worker on the account spent, so a run is cut off by what ran before it as much as by what it dispatches. Run `bun scripts/orchestrate.ts remaining-budget` before each dispatch as well, which prints what each window has spent and when it resets, or a line opening `unknown` where the file it reads is missing or stale, leaving the cap below as the whole bound. Hold the run while the five-hour window prints 80% or more, and start it again after the reset that line names; the seven-day window is not a hold condition, and 80 is a choice rather than a measurement, because nothing yet ties a window's percentage to what one ticket spends. Dispatch at most three workers in flight at once, however much memory `free-gib` reports and however much of a window `remaining-budget` leaves: on 2026-09-08 the dispatching session hit its limit twice with five workers in flight and zero times with two or three, and on 2026-09-09 thirteen tickets with at most three in flight took the five-hour window from 12% to 85% before the limit killed two workers mid-ticket. A limit hit kills every worker in flight mid-ticket; `SendMessage` resumed those two from their transcripts after the reset.
- **The dispatching session runs only what `.claude/settings.json` allowlists.** That session keeps to `Agent` and the commands that file allowlists, the four of `scripts/orchestrate.ts` and `gh pr merge --squash`. A pull request whose author was refused at the merge step is merged from the dispatching session rather than by a worker dispatched for that purpose. Ad-hoc `git`, `gh`, and file edits belong to workers, including the worker dispatched to resolve a conflict.
- **Resolve a conflict by rebasing onto main.** `git fetch origin && git rebase origin/main`, resolve, run `bun run check` and `bun run test`, then `git push --force-with-lease` to the PR's own branch and no other. A PR no person has reviewed counts as Draft for the History rule below, so the rebase is allowed.
- **History:** while a PR is Draft, keep its commits clean (rebase freely). Once review has started, never rewrite reviewed commits. Add fixes on top, and integrate preserving the commit/review order, typically with a merge commit.
- **Answer every review comment in its thread.** Name the change you made, or the reason none was needed. Where you judge the finding wrong, the user decides: give them the problem the reviewer found, the change the reviewer asked for, and your reason for refusing, so they can decide without reading the thread.
