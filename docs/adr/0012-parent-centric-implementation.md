# 0012. The parent session implements directly; delegation is decided by context impact

- Status: accepted
- Date: 2026-07-09

> Note: AGENTS.md, `start-workflow`, and `docs/agent-workflow.md` referenced this
> decision as "ADR-0013" before it was written down. The number is 0012 — the
> sequence has no gaps (see `docs/adr/README.md` numbering rules).

## Context

ADR-0003 delegated all ticket-granularity implementation to subagents: the
parent session briefed, dispatched, reviewed, and committed, while
`general-purpose` (sonnet) subagents did the editing. The rationale was context
protection (implementation noise fills the parent's window) and cost (most
edits don't need the parent's model).

Operating that policy surfaced costs the ADR did not anticipate:

- **Briefing overhead dominates small-to-medium tasks.** A self-contained
  dispatch prompt (goal, file paths, rules, acceptance criteria) often costs
  more tokens than the edit itself, and the parent re-reads the diff afterwards
  anyway because summaries lose information.
- **Round-trips serialize naturally interactive work.** Fixing review findings,
  integrating dispatched units, and follow-up corrections all bounce between
  parent and worker with no context carried over.
- **The per-edit lint hook and the review gate moved the quality argument.**
  Quality is enforced mechanically (hooks) and by a fresh-context reviewer
  (ADR-0011), not by which session typed the edit.

Meanwhile the real context-bloat culprits are bulk reads and log digging —
exploration, not implementation.

## Decision

**The parent session implements directly by default.** Delegation is decided by
**context impact, not task size**:

- **Parent edits directly**: normal implementation, fixes, integration, and
  post-review follow-ups — whenever the scope is understood.
- **Explore / research subagents**: bulk file reads, log digging, cross-cutting
  investigation whose raw output the parent won't reference again — only the
  summary should enter the parent's context.
- **Parallel implementation subagents**: multiple independent units with no
  shared files and no output dependency. Dependent units run sequentially — or
  stay in the parent. Implementation dispatches run foreground (synchronous).

Supersedes ADR-0003. The model-selection table and delegation criteria are
codified in AGENTS.md ("Delegation", "Model selection"); `start-workflow`
step 5 follows this decision.

## Alternatives considered

- **Keep ADR-0003 (always dispatch ticket work)**: rejected — briefing +
  summary-loss + round-trip costs exceed the context saved on most tasks, and
  the quality gates no longer depend on dispatch.
- **Never delegate**: rejected — exploration genuinely poisons the parent's
  context with raw output, and independent parallel units genuinely gain
  wall-clock time from fan-out.
- **Delegate by task size (small = parent, large = subagent)**: rejected — size
  is a poor proxy. A large mechanical edit is fine in the parent; a small
  investigation that reads 40 files is not.

## Consequences

- Parent context grows faster on implementation-heavy tasks; the mitigation is
  delegating *exploration*, which is where the bulk of avoidable tokens live.
- Review independence matters more: the `code-reviewer` agent (ADR-0011) is now
  the only fresh-context check on parent-written code. Its gate must stay
  mechanically enforced.
- Dispatch briefings, when they do happen, must remain self-contained — nothing
  about this decision changes subagent isolation.
- The per-edit lint hook applies to parent edits, so quality feedback stays
  continuous even without a dispatched worker.
