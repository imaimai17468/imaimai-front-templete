# 0003. Ticket-granularity implementation is delegated to subagents

- Status: accepted
- Date: 2026-04-24

## Context

When the parent session (the one talking to the user) implements features directly, two costs accumulate:

1. The parent's context window fills with implementation details (file reads, search results, intermediate edits) that aren't needed for orchestration. As context grows, response quality degrades.
2. Every implementation step uses the parent's model (typically Opus). Most implementation steps don't need Opus; they need a competent executor.

Claude Code provides the `Agent` tool, which dispatches a fresh subagent with isolated context and a per-call model override. Built-in subagent types include `general-purpose` (full toolkit), `Explore` (read-only search), `Plan` (design only), and others.

## Decision

Implementation work at "ticket" granularity — components, bug fixes, refactors, anything that would normally be one PR — is dispatched to a subagent rather than executed in the parent session. The parent's job is briefing, dispatch, review, and commit/PR.

Default models per subagent type are codified in `.claude/rules/agents.md`:

- `general-purpose` → `sonnet`
- `Explore` → `haiku`
- `Plan` → `sonnet`

`opus` is used only when the dispatched task involves non-trivial design judgment or when a `sonnet`-level run came back with low-quality output.

Trivial work (one-line fixes, typo corrections, config tweaks) stays in the parent — dispatch overhead exceeds the savings.

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled for genuine multi-agent parallel collaboration only, not for single-task offloads.

## Alternatives considered

- **Always implement in the parent**: rejected — context bloat and Opus overuse on mechanical work.
- **Always dispatch (including trivial)**: rejected — briefing overhead and the round-trip latency outweigh savings on small edits.
- **Always use Opus in subagents**: rejected — defeats the cost-saving purpose. Most ticket-granularity work runs cleanly on Sonnet.
- **Build many task-specific custom subagents** (`component-scout`, `bug-hunter`, etc.): rejected for now — speculative without observed need. Add when a clear pattern emerges from real use.

## Consequences

- Parent context stays compact across long conversations, preserving response quality.
- Cost per implementation drops because Sonnet/Haiku do the bulk of the work.
- The user sees a "diff plus summary" return rather than a streaming implementation, which is worse for live observation but better for asynchronous review.
- Subagents inherit no in-session memory, so briefings must be self-contained — every dispatch needs explicit context, file paths, and acceptance criteria. This is a deliberate trade for isolation.
