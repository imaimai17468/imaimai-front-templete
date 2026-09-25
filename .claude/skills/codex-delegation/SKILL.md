---
name: codex-delegation
description: "Hand a ticket's mechanical implementation to the Codex CLI (`codex exec`) while the Claude worker keeps the ticket: what Codex is given, what never leaves Claude, the sandbox the call runs under, and what the worker does with the diff that comes back. Invoke at `ticket-work` step 5 when the change's acceptance is a command's exit code and its specification is already written."
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
- the commit split, the `code-reviewer` pass, the PR body, and the merge

## The call

Codex runs in the ticket's own worktree and writes its last message to a file the worker reads:

```
codex exec -C .claude/worktrees/<ticket> -s workspace-write -o <scratchpad>/codex-<ticket>.md - < <scratchpad>/codex-<ticket>-prompt.md
```

Both paths are written out as literals and the prompt arrives on stdin behind a `-` argument, because the Bash guards AGENTS.md's Degraded Environments names refuse the same call with the worktree path, the `-o` path or the prompt held in a variable. `/usr/bin/time -p codex exec …` is refused as well, so a `date` call on either side records the wall clock.

`-o` points outside the worktree because a path inside it turns up in `git status` and muddies the diff the worker is about to review.

`-s workspace-write` is the sandbox for this. `read-only` cannot edit a file, so Codex could not make the change at all, and `danger-full-access` executes model-generated commands with no filesystem boundary, so one of them reaches the main checkout and `~`, which is what running the ticket in its own worktree exists to prevent. Pass neither `--approve-for-me` nor `--dangerously-bypass-approvals-and-sandbox`: a command the sandbox refused is information the worker wants, and the second flag removes the sandbox.

The prompt carries the ticket's own text, the command that accepts the work (`bun run check`, `bun run test`, or the one test file), and the constraint that Codex commits nothing and pushes nothing, leaving every change in the working tree. Add AGENTS.md's layering rule when the change crosses the layers its Rules section names.

Handing Codex the target as literal code does not settle what it writes: told to write `const AVATAR_REJECTION_MESSAGES: Record<AvatarSizeRejection, string> = {…}` and `describe("parseProfileUpdate", …)`, it shipped `satisfies Record<…>` and `describe(parseProfileUpdate, …)`, which `bun run lint` then reported as `anti-slop(no-known-value-widening)` and `vitest(prefer-describe-function-title)`. Name the branch a test must reach together with the input that reaches it, because a branch named alone gets the cheapest input rather than the one production sends: told to cover a size limit, Codex redefined a `File`'s `size` with `Object.defineProperty` instead of allocating the bytes.

Outbound network inside this sandbox is a separate opt-in (`sandbox_workspace_write.network_access`), so the `bun run setup` that `ticket-work` opens with runs in the worktree before delegating rather than the sandbox widening for `bun install`. Where a command Codex needs is refused, the worker runs that command itself.

`~/.codex/config.toml` sets `model = "gpt-6-astra"` and `model_reasoning_effort = "low"`, and a run inherits both. Raise either for one run with `-m <model>` or `-c model_reasoning_effort=<level>`, because that file is the user's.

To hand back a correction, `codex exec resume --last "<what is wrong>"` from the same worktree continues that session, since resume filters sessions by cwd unless `--all` is passed.

## What the worker does with the result

The `-o` file holds Codex's summary, and `ticket-work` step 6 sends the worker to the diff instead. Check `git status` and `git log` to confirm the change is uncommitted. Then run `bun run check` and `bun run test`, and carry the ticket on from step 6 as your own work: the acceptance criteria, the review, the commits, the PR.

Four things the diff and the exit code report differently from what happened:

- `workspace-write` leaves git's index unwritable, so `git mv` is refused and Codex renames on the filesystem. `git status` shows each rename as a deletion plus an untracked file, and `git add` naming both the old and the new path restores rename detection.
- Codex reports `bun run test` as exit 1 on 5-second timeouts in `.claude/hooks/pre-bash-guard.test.ts`, which spawns a shell per case and fails intermittently with nothing delegated. Run that file alone to decide whether it is really failing, rather than reading the exit code or one re-run of the full suite as the answer.
- A rename Codex performs exactly as specified can still leave the file's new name false. It renamed `src/lib/auth/session.ts` as told, and the `getUser` inside derived `session?.user ?? null`, two untested branches that the `.live.ts` name then exempted by claiming the logic is tested elsewhere.
- Told to sweep the repository for further references to a renamed path, Codex edits path literals in prose too, such as `docs/DEPLOYMENT.md`. Such a sweep reaches text this skill otherwise keeps with Claude, and the worker reads that hunk like any other.

The commit takes no second `Co-Authored-By:` trailer for Codex, because after the worker has read the whole diff and changed what it disagreed with, the commit is the worker's to answer for. The PR body names the delegation, where a reviewer can act on it.

## What has been measured

Three delegations ran on 2026-09-09, the three tickets of one series: five renames with their reference updates and a rewritten `coverageExclude` array in `vitest.config.mts`, then four renames to `*.live.ts` with five `coverageExclude` entries deleted, then two renames with a restructure of `src/server/fn/profile.ts` into the deps-injecting shape its siblings already use and a new `src/server/fn/profile.test.ts` covering that file's 14 branches. Each inherited `gpt-6-astra` at `model_reasoning_effort = "low"`, exited 0, and made every edit its prompt named, in 2m35s, 5m07s and 4m38s of wall clock. The second run's diff needed one change on review, the false `.live.ts` name above.

`codex exec` printed 57,463, 42,237 and 49,743 tokens used, each run's uncached input plus its output. That order matches neither the ticket's file count nor the wall clock, so these three measurements separate nothing about what makes a ticket cost more. What they do bound is the printed figure itself, which stayed between 42k and 58k while the rollout under `~/.codex/sessions/` ended between 436,343 and 996,477 total tokens, the gap being cached input. The Claude worker holding each ticket spent 225k, 170k and 200k by the counter AGENTS.md's dispatch bullet measures, three to five times what Codex printed, with the design, the prose, the review and the pull request its own work each time.

Executed on 2026-09-09: `codex --version` (`codex-cli 0.153.4` at `~/.local/bin/codex`), `codex login status` (`Logged in using ChatGPT`), `~/.codex/config.toml`'s two model keys, and the `--help` output of `codex exec`, `codex exec resume` and `codex sandbox`. Read rather than run: every flag's effect, what `workspace-write` leaves writable, and the network opt-in, which come from `--help` and Codex's configuration reference.
