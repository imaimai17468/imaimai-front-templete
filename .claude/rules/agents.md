# Agent Dispatch

## Delegation default

Tasks at the granularity of "implement a component", "fix a bug", or "refactor this module" should be **dispatched to a subagent** rather than implemented in the parent session. The parent's job is:

1. Gather requirements and relevant context (`AGENTS.md`, related files, acceptance criteria)
2. Write a self-contained briefing for the subagent
3. Dispatch via the `Agent` tool
4. Verify the returned diff and summary
5. Handle commit / PR

Exception: trivial one-liners, typo fixes, and config tweaks are done directly in the parent — dispatch overhead isn't worth it.

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
