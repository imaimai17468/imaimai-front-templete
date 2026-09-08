---
name: codex-delegation
description: Hand a ticket's mechanical implementation to the Codex CLI (`codex exec`) while the Claude worker keeps the ticket: what Codex is given, what never leaves Claude, the sandbox the call runs under, and what the worker does with the diff that comes back. Invoke at `ticket-work` step 5 when the change's acceptance is a command's exit code and its specification is already written.
---

# Codex delegation

One Claude worker spent 96k to 338k tokens per ticket on the 2026-09-08 run. The part of a ticket a gate can accept or reject does not need this repository's judgment, so it goes to Codex, and the worker keeps the ticket.

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

The prompt carries the ticket's own text, the command that accepts the work (`bun run check`, `bun run test`, or the one test file), and the constraint that Codex commits nothing and pushes nothing, leaving every change in the working tree. Add AGENTS.md's layering rule when the change crosses `routes/` → `server/fn/` → `gateways/` → `entities/`.

Outbound network inside this sandbox is a separate opt-in (`sandbox_workspace_write.network_access`), so run `bun run setup` in the worktree before delegating rather than widening the sandbox for `bun install`. Where a command Codex needs is refused, the worker runs that command itself.

`~/.codex/config.toml` sets `model = "gpt-6-astra"` and `model_reasoning_effort = "low"`, and a run inherits both. Raise either for one run with `-m <model>` or `-c model_reasoning_effort=<level>`, because that file is the user's.

To hand back a correction, `codex exec resume --last "<what is wrong>"` from the same worktree continues that session, since resume filters sessions by cwd unless `--all` is passed.

## What the worker does with the result

Read the full diff with `git diff`, rather than the summary in the `-o` file, which is what `ticket-work` step 6 requires of anything a subagent implemented. Check `git status` and `git log` to confirm the change is uncommitted. Then run `bun run check` and `bun run test`, and carry the ticket on from step 6 as your own work: the acceptance criteria, the review, the commits, the PR.

The commit takes one `Co-Authored-By:` trailer, crediting the model the worker runs as, and no second trailer for Codex. AGENTS.md names one trailer for the current model, and after the worker has read the whole diff and changed what it disagreed with, the commit is the worker's to answer for. The PR body names the delegation, where a reviewer can act on it.

## What has been executed

Executed on 2026-09-09: `codex --version` (`codex-cli 0.153.4` at `~/.local/bin/codex`), `codex login status` (`Logged in using ChatGPT`), `~/.codex/config.toml`'s two model keys, and the `--help` output of `codex exec`, `codex exec resume` and `codex sandbox`.

Read rather than run: every flag's effect, what `workspace-write` leaves writable, and the network opt-in, which come from `--help` and Codex's configuration reference. No delegation has been run through this skill, because doing so would have spent the user's Codex quota on invented work. The first worker to use it reports where the procedure diverges instead of assuming these steps hold.
