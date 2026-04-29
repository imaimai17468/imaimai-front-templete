# Agent Dispatch

## Delegation default

Tasks at the granularity of "implement a component", "fix a bug", or "refactor this module" should be **dispatched to a subagent** rather than implemented in the parent session. The parent's job is:

1. Gather requirements and relevant context (`AGENTS.md`, related files, acceptance criteria)
2. Write a self-contained briefing for the subagent
3. Dispatch via the `Agent` tool
4. Verify the returned diff and summary
5. Handle commit / PR

Exception: trivial one-liners, typo fixes, and config tweaks are done directly in the parent — dispatch overhead isn't worth it.

## Before each dispatch — Aegis is mandatory

**Every** subagent dispatch MUST be preceded by a fresh `aegis_compile_context` call whose `target_files` and `plan` reflect the briefing you are about to send. One call per session is NOT enough — Aegis must be re-consulted whenever the target file set or the intent changes (i.e., before every `Agent` tool call). The returned guidelines MUST be quoted into the briefing so the subagent does not need to re-derive them.

## When a subagent returns incomplete

If a dispatched subagent reports partial completion, gives up, errors out, or otherwise leaves work undone, the parent MUST NOT pick up the remaining implementation in-session. Instead:

1. Read the subagent's diff and summary, and identify exactly what is left.
2. Write a new self-contained briefing for the missing slice (include the prior subagent's diff as context, and the explicit slice that is still missing).
3. **Dispatch a new subagent** for that slice. Re-consult `aegis_compile_context` first.

The parent only intervenes directly for the trivial-edit exception above (one-liners / typo / config). Anything else is delegated. Parent-side implementation after a subagent stall is the anti-pattern this rule exists to block — do not rationalize past it.

## Model selection for subagents

When dispatching a subagent, **always set `model` explicitly**. Omitting it means inheriting the parent (often Opus), which is expensive for most work.

Defaults by agent type:

| `subagent_type` | Default `model` to use | Rationale |
|---|---|---|
| `general-purpose` | `sonnet` | Implementation / bug fix / refactor work at ticket granularity |
| `Explore` | `haiku` | Read-only search, no design judgment needed |
| `Plan` | `sonnet` | Design requires some reasoning but not Opus-level |
| `claude-code-guide` | inherit (usually already set) | Model is already optimized per agent definition |

Escalate to `opus` only when the task involves non-trivial architectural judgment, a subtle bug hunt, or the subagent came back with low-quality output on `sonnet`.

## Teams

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled for **genuine parallel collaboration** (multiple agents working on independent branches of the same effort simultaneously). Do not use teams for simple single-task offloads — dispatch a single subagent instead.

## Before reporting done

For multi-file implementations, added branches, or new pure functions: re-read the diff once more before declaring done. Look for missing test coverage on new branches, dead code / over-abstraction that the task didn't require, and null/undefined/off-by-one/async bug patterns types can't catch. Fix, then verify with `bun run typecheck` / `bun run test`. Coding-rule conformance is handled by the stop hook — this pass is for the quality concerns above only. Skip the pass entirely for one-liners, config-only, or docs-only changes.

After self-review, **invoke `Skill("superpowers:requesting-code-review")` and run an independent reviewer pass** before claiming the work is complete. Self-review alone is not enough for ticket-granularity work: the reviewer must be a fresh agent without your context so it can spot blind spots, missed regressions, and conventions you forgot to apply. Only mark the work as done after the reviewer's findings have been addressed (or explicitly justified as out of scope).

Skip the independent review only for the same trivial scope where the self-review pass is skipped (one-liner / config-only / docs-only). Anything that touches more than one file, adds a new branch, or introduces a new pure function MUST go through review.
