---
name: codex-delegation
description: Hand a ticket's mechanical implementation to the Codex CLI (`codex exec`) while the Claude worker keeps the ticket: what Codex is given, what never leaves Claude, the sandbox the call runs under, and what the worker does with the diff that comes back. Invoke at `ticket-work` step 5 when the change's acceptance is a command's exit code and its specification is already written.
---

# Codex delegation

What a Claude worker spends on one ticket is the counter AGENTS.md's dispatch bullet measures. The part of a ticket a gate can accept or reject does not need this repository's judgment, so it goes to Codex, and the worker keeps the ticket.

## What Codex is handed

Work whose acceptance is a command's exit code and whose specification is already written:

- a mechanical change repeated across many files, where the shape of the edit is settled and only the call sites vary
- a test-writing pass against a stated coverage target, where `bun run test` decides
- a sweep a lint rule already names, where the rule's message is the specification

Where you would have to write out what "correct" means before Codex could start, the specification is not written yet, and `ticket-work` step 5 stands as it is: the worker implements it.

## What stays with Claude

Anything this repository's own rules decide rather than a gate:

- prose and instruction documents (`.claude/`, `AGENTS.md`, a PR body, a review comment). `.claude/rules/prose.md` and AGENTS.md's comment rules are judgment no gate checks, so text is not delegated.
- a design choice between credible alternatives, which is `ticket-work` step 2
- the commit split, the `simplify` and `code-reviewer` pass, the PR body, and the merge

## The call

Codex runs in the ticket's own worktree and writes its last message to a file the worker reads:

```
codex exec -C "$WORKTREE" -s workspace-write -o "$TMPDIR/codex-<ticket>.md" "$PROMPT"
```

`-o` points outside the worktree because a path inside it turns up in `git status` and muddies the diff the worker is about to review.

`-s workspace-write` is the sandbox for this. `read-only` cannot edit a file, so Codex could not make the change at all, and `danger-full-access` executes model-generated commands with no filesystem boundary, so one of them reaches the main checkout and `~`, which is what running the ticket in its own worktree exists to prevent. Pass neither `--approve-for-me` nor `--dangerously-bypass-approvals-and-sandbox`: a command the sandbox refused is information the worker wants, and the second flag removes the sandbox.

The prompt carries the ticket's own text, the command that accepts the work (`bun run check`, `bun run test`, or the one test file), and the constraint that Codex commits nothing and pushes nothing, leaving every change in the working tree. Add AGENTS.md's layering rule when the change crosses the layers its Rules section names.

Outbound network inside this sandbox is a separate opt-in (`sandbox_workspace_write.network_access`), so the `bun run setup` that `ticket-work` opens with runs in the worktree before delegating rather than the sandbox widening for `bun install`. Where a command Codex needs is refused, the worker runs that command itself.

`~/.codex/config.toml` sets `model = "gpt-6-astra"` and `model_reasoning_effort = "low"`, and a run inherits both. Raise either for one run with `-m <model>` or `-c model_reasoning_effort=<level>`, because that file is the user's.

To hand back a correction, `codex exec resume --last "<what is wrong>"` from the same worktree continues that session, since resume filters sessions by cwd unless `--all` is passed.

## What the worker does with the result

The `-o` file holds Codex's summary, and `ticket-work` step 6 sends the worker to the diff instead. Check `git status` and `git log` to confirm the change is uncommitted. Then run `bun run check` and `bun run test`, and carry the ticket on from step 6 as your own work: the acceptance criteria, the review, the commits, the PR.

The commit takes no second `Co-Authored-By:` trailer for Codex, because after the worker has read the whole diff and changed what it disagreed with, the commit is the worker's to answer for. The PR body names the delegation, where a reviewer can act on it.

## What has been executed

Executed on 2026-09-09: `codex --version` (`codex-cli 0.153.4` at `~/.local/bin/codex`), `codex login status` (`Logged in using ChatGPT`), `~/.codex/config.toml`'s two model keys, and the `--help` output of `codex exec`, `codex exec resume` and `codex sandbox`.

Read rather than run: every flag's effect, what `workspace-write` leaves writable, and the network opt-in, which come from `--help` and Codex's configuration reference.

The first delegation ran on 2026-09-09: five renames with their reference updates and a rewritten `coverageExclude` array in `vitest.config.mts`, accepted by `bun run test` and `bun run check`, which Codex ran itself. It inherited `gpt-6-astra` at `model_reasoning_effort = "low"`, took 2m35s wall clock, exited 0, and made every edit the prompt named, with nothing for the worker's own read of the diff to change. `codex exec` printed `tokens used 57,463`, which is its uncached input (54,909) plus its output (2,554); that run's rollout under `~/.codex/sessions/` ends at `total_token_usage.total_tokens` 436,343, the gap being 378,880 cached input tokens, and a 35-second fork of the same session recorded a further 89,408. The Claude worker holding the ticket had spent 225k by the counter AGENTS.md's dispatch bullet measures, by the time it had the pull request open and rebased onto main, with the design, the prose, the review and the pull request its own work.

Two places that run diverged from the procedure above:

- The call as written, with `-C "$WORKTREE"` and the prompt in `"$PROMPT"`, was refused by one of the Bash guards AGENTS.md's Degraded Environments names. Write the worktree path and the `-o` path as literals, and pass the prompt file on stdin with a `-` argument in place of the prompt.
- `git mv` is refused by `workspace-write`, which leaves git's index unwritable, so Codex renamed the files on the filesystem and `git status` showed each as a deletion plus an untracked file. `git add` naming both the old and the new path restores rename detection.

The second delegation ran on 2026-09-09, the next ticket of the same series: four renames to `*.live.ts` with their reference updates, and five path entries deleted from `coverageExclude`. It inherited `gpt-6-astra` at `model_reasoning_effort = "low"`, took 5m07s wall clock, exited 0, and made every edit the prompt named. `codex exec` printed `tokens used 42,237`, which is its uncached input (38,655) plus its output (3,582); that run's rollout ends at `total_token_usage.total_tokens` 996,477, the gap being 954,240 cached input tokens, and a fork of the same session recorded a further 94,603. The Claude worker holding the ticket had spent 170k by the counter AGENTS.md's dispatch bullet measures, by the time its five review agents had reported and every commit was pushed, with the design decision, the reviews, the commit split and the pull request its own work. Codex's diff needed one change on review. It renamed `src/lib/auth/session.ts` as told, and the `getUser` inside that file derives `session?.user ?? null`, two untested branches that the `.live.ts` name then exempted by claiming the logic is tested elsewhere. A rename Codex performs exactly as specified can still leave the file's new name false, and catching that is what the worker's own read of the diff is for.

Both divergences above held on that run. Three more appeared:

- Codex reported `bun run test` as exit 1, naming 5-second timeouts in `.claude/hooks/pre-bash-guard.test.ts`. That file spawns a shell per case against a 5-second per-test timeout, sits outside `coverageInclude`, and the diff did not touch it. It fails intermittently with no `codex exec` running. Of six full-suite runs in one worktree on 2026-09-09, three failed with 25, 10 and 2 timeouts and three passed, and the file alone passed at 202 tests both times it was run that way. Run it alone to decide whether it is really failing, rather than reading Codex's exit code or one re-run of the full suite as the answer.
- `codex exec` wrote two rollout files, the second carrying `forked_from_id` of the first. Total a run from both.
- Told to search the repository for any further reference to the renamed paths, Codex edited a path literal inside `docs/DEPLOYMENT.md`. Prose files hold path references, so such a sweep reaches text this skill otherwise keeps with Claude, and the worker reads that hunk like any other.

The third delegation ran on 2026-09-09, the last ticket of the same series: two renames with their reference updates, a restructure of `src/server/fn/profile.ts` into the deps-injecting shape its two siblings already use, a new `src/server/fn/profile.test.ts` covering that file's 14 branches, and three path entries deleted from `coverageExclude`. It inherited `gpt-6-astra` at `model_reasoning_effort = "low"`, took 4m38s wall clock, exited 0, and made every edit the prompt named. `codex exec` printed `tokens used 49,743`, which is its uncached input (44,504) plus its output (5,239); that run's rollout ends at `total_token_usage.total_tokens` 809,167, the gap being 759,424 cached input tokens, and a fork of the same session recorded a further 247,351. The Claude worker holding the ticket had spent 200k by the counter AGENTS.md's dispatch bullet measures, at the point its five review agents had reported and its four code commits were pushed.

Across the three runs `codex exec` printed 57,463, 42,237 and 49,743 tokens. That order matches neither the ticket's file count (five renames, four renames, two renames plus a 200-line test file) nor the wall clock (2m35s, 5m07s, 4m38s), so these three measurements separate nothing about what makes a ticket cost more. What they do bound is the printed figure itself, which stayed between 42k and 58k while the rollout total, counting cached input, ranged from 436k to 996k. The Claude worker spent 225k, 170k and 200k over the same three tickets, three to five times what Codex printed, with the design, the prose, the review and the pull request its own work each time.

Both divergences from the first run held again. `git mv` was refused, so `git status` showed each rename as a deletion plus an untracked file. `codex exec` wrote two rollout files, the second carrying `forked_from_id` of the first. Codex reported `bun run test` as exit 0 this time, with no `pre-bash-guard.test.ts` timeouts.

Three more appeared:

- `/usr/bin/time -p codex exec …` is refused by one of those guards as well. Record the wall clock with a `date` call on either side instead.
- A prompt that hands Codex the target file as literal code still loses to this project's lint. Told to write `const AVATAR_REJECTION_MESSAGES: Record<AvatarSizeRejection, string> = {…}` and `describe("parseProfileUpdate", …)`, Codex shipped `satisfies Record<…>` and `describe(parseProfileUpdate, …)`, and said so in its final message rather than leaving them to be found. Restoring each to the prompt's form and running `bun run lint` returned `anti-slop(no-known-value-widening)` and `vitest(prefer-describe-function-title)`, which is how the worker checks such a claim.
- Codex reached the size-limit branch by redefining a `File`'s `size` with `Object.defineProperty`, which the prompt had neither asked for nor forbidden. The worker replaced it with a real allocation, so the byte length the validator reads is the fixture's own. Where a prompt names a branch to cover without saying what the input must be, Codex picks the cheapest input rather than the one production would see.
