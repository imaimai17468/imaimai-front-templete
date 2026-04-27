# 0004. `permissions.deny` is the security boundary, not `ask`

- Status: accepted
- Date: 2026-04-23

## Context

`.claude/settings.json` permissions have three buckets: `allow` (auto-execute), `ask` (prompt user), `deny` (refuse). The initial configuration used only `allow` and `ask`, treating `ask` as the safety net for risky operations like `git push` or `rm`.

This relies on the user actually reading and refusing the prompt. In practice:

- Permission modes (`acceptEdits`, `bypassPermissions`, `--dangerously-skip-permissions`, auto mode) collapse `ask` into effective `allow`.
- Prompt-injection content from web pages, MCP tools, or files can pressure the agent into running destructive commands; an `ask` dialog mixed in with legitimate requests is easy to approve mechanically.
- Some actions are not reversible enough for prompt-based gating to be useful — `rm -rf`, `git push --force` to main, `git reset --hard`, dropping `.env` reads — and should be refused outright.

## Decision

`deny` enumerates operations that are never acceptable, even with explicit approval. Specifically:

- Destructive `rm` (`-rf` / `-fr` / `-r`)
- Force-push variants and `--force-with-lease`
- `git reset --hard`, `git clean -fd[x]`, `git branch -D`, `git checkout .` / `--`, `git restore .` / `--`
- `git commit --amend` (history rewriting on shared work)
- `sudo`, broad `chmod -R`
- `Read` / `Write` / `Edit` against `.env`, `.env.local`, `.env.development`, `.env.production`

`ask` covers the remaining consequential operations (normal `git push`, `git commit`, `gh pr create`, deploys, `rm` of single files, `bun add` without `-E`).

`allow` is widened to cover read-only operations (git status / log / diff / show / branch / blame, `gh pr view`, `bun pm ls`) so the user is not interrupted for routine inspection.

## Alternatives considered

- **Keep using `ask` for everything risky**: rejected — `ask` is bypassable in multiple modes and depends on human vigilance.
- **`deny` everything except a small `allow` list**: rejected — too restrictive for normal flow, generates constant friction.
- **External wrapper script that filters commands before they reach Bash**: rejected for now — `permissions` is the supported mechanism, and external wrappers are easy to circumvent and harder to debug.

## Consequences

- Destructive operations are off the table regardless of session mode or prompt-injection pressure.
- `ask` bucket stays focused on operations a user genuinely should approve case-by-case.
- New tools added to the project may need explicit `allow` entries; otherwise they fall through to the default `ask`. This is a feature — it forces conscious decision-making about new tooling.
- When this list needs to evolve (new bypass techniques, new tools), edit `.claude/settings.json` directly.
