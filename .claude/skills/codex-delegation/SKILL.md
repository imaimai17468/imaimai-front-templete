---
name: codex-delegation
description: "Hand a ticket's mechanical implementation to the Codex CLI (`codex exec`) while the Claude worker keeps the ticket: what Codex is given, what never leaves Claude, the sandbox the call runs under, and what the worker does with the diff that comes back. Invoke at `ticket-work` step 5 when the change's acceptance is a command's exit code and its specification is already written."
---

# Codex delegation

What a Claude worker spends on one ticket counts against the usage windows `ticket-work`'s *Tickets and waves* bounds a dispatch by. The part of a ticket a gate can accept or reject does not need this repository's judgment, so it goes to Codex, and the worker keeps the ticket.

## What Codex is handed

Work whose acceptance is a command's exit code and whose specification is already written:

- a mechanical change repeated across many files, where the shape of the edit is settled and only the call sites vary
- a test-writing pass against a stated coverage target, where `bun run test` decides
- a sweep a lint rule already names, where the rule's message is the specification

Where you would have to write out what "correct" means before Codex could start, the specification is not written yet, and `ticket-work` step 5 stands as it is: the worker implements it.

## What stays with Claude

Anything this repository's own rules decide rather than a gate:

- prose and instruction documents (`.claude/`, `AGENTS.md`, a PR body, a review comment). `.claude/hooks/guidance/prose.md` and AGENTS.md's comment rules are judgment no gate checks, so text is not delegated.
- a design choice between credible alternatives, which is `ticket-work` step 2
- the commit split, the `code-reviewer` pass, the PR body, and the merge

## The call

Codex runs in the ticket's own worktree and writes its last message to a file the worker reads:

```
codex exec -C .claude/worktrees/<ticket> -s workspace-write -o <scratchpad>/codex-<ticket>.md - < <scratchpad>/codex-<ticket>-prompt.md
```

Write both paths out as literals and send the prompt on stdin behind a `-` argument, because in a worktree-isolated session the guard AGENTS.md's Degraded Environments names refuses a command it cannot verify stays inside the worktree, and a path or a prompt held in a variable can make it one.

`-o` points outside the worktree because a path inside it turns up in `git status` and muddies the diff the worker is about to review.

`-s workspace-write` is the sandbox for this. `read-only` cannot edit a file, so Codex could not make the change at all, and `danger-full-access` executes model-generated commands with no filesystem boundary, so one of them reaches the main checkout and `~`, which is what running the ticket in its own worktree exists to prevent. Pass neither `--approve-for-me` nor `--dangerously-bypass-approvals-and-sandbox`: a command the sandbox refused is information the worker wants, and the second flag removes the sandbox.

The prompt carries the ticket's own text, the command that accepts the work (`bun run check`, `bun run test`, or the one test file), and the constraint that Codex commits nothing and pushes nothing, leaving every change in the working tree. Add AGENTS.md's layering rule when the change crosses the layers its Rules section names.

Codex can write code other than the literal code the prompt hands it, so read the diff against the pasted target rather than trusting that it landed as pasted. Name the branch a test must reach together with the input that reaches it, because a branch named alone gets the cheapest input rather than the one production sends, such as a `File` whose `size` is redefined in place of one holding the bytes.

Outbound network inside this sandbox is a separate opt-in (`sandbox_workspace_write.network_access`), so the `bun run setup` that `ticket-work` opens with runs in the worktree before delegating rather than the sandbox widening for `bun install`. Where a command Codex needs is refused, the worker runs that command itself.

`~/.codex/config.toml` sets `model = "gpt-6-astra"` and `model_reasoning_effort = "low"`, and a run inherits both. Raise either for one run with `-m <model>` or `-c model_reasoning_effort=<level>`, because that file is the user's.

To hand back a correction, `codex exec resume --last "<what is wrong>"` from the same worktree continues that session, since resume filters sessions by cwd unless `--all` is passed.

## What the worker does with the result

The `-o` file holds Codex's summary, and `ticket-work` step 6 sends the worker to the diff instead. Check `git status` and `git log` to confirm the change is uncommitted. Then run `bun run check` and `bun run test`, and carry the ticket on from step 6 as your own work: the acceptance criteria, the review, the commits, the PR.

Three things the diff and the exit code report differently from what happened:

- `workspace-write` leaves git's index unwritable, so `git mv` is refused and Codex renames on the filesystem. `git status` shows each rename as a deletion plus an untracked file, and `git add` naming both the old and the new path restores rename detection.
- A rename Codex performs exactly as specified can still leave the file's new name false: a file given a suffix that `vitest.config.mts`'s `coverageExclude` matches, such as `*.entry.ts`, leaves the coverage gate even while it still holds branches no test reaches.
- Told to sweep the repository for further references to a renamed path, Codex edits path literals in prose too, such as `docs/DEPLOYMENT.md`. Such a sweep reaches text this skill otherwise keeps with Claude, and the worker reads that hunk like any other.

The commit takes no second `Co-Authored-By:` trailer for Codex, because after the worker has read the whole diff and changed what it disagreed with, the commit is the worker's to answer for. The PR body names the delegation, where a reviewer can act on it.

