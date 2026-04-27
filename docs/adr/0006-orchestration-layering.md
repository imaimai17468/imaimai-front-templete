# 0006. `/start-workflow` is the single orchestration entry; aegis / superpowers / custom skills are sub-steps

- Status: accepted
- Date: 2026-04-27

## Context

The repository now has five overlapping layers that all participate in steering an AI coding agent through a task:

1. **Permission gates** (`.claude/settings.json` `deny` / `ask` / `allow`) — physically refuses destructive operations.
2. **Hooks** (`pre-tool-use-guard`, `stop-quality-gate`, `stop-agent-review`, `stop-component-verify`) — mechanical enforcement of coding rules.
3. **`.claude/rules/*.md` via `AGENTS.md` `@include`** — keeps coding rules in the prompt at all times.
4. **aegis** (MCP server, agent + admin surfaces) — deterministic context compilation: given `target_files`, returns the relevant rule / ADR documents with relevance scores.
5. **superpowers** (Claude marketplace plugin) — opinionated methodology: brainstorming → plans → git worktrees → subagent-driven dev → TDD → review → finishing.

Plus the project's own custom skills: `start-workflow` (entry point), `commit`, `pr`, `empirical-prompt-tuning`.

Layers 4 and 5 in particular have overlapping concerns:

- aegis returns rule docs based on file paths; the same docs are already loaded via `@include`. Without a clear policy this means the same content arrives twice.
- superpowers' `brainstorming` / `writing-plans` overlap with `start-workflow`'s clarify / plan steps.
- superpowers' `subagent-driven-development` overlaps with the project's `agents.md` dispatch policy.

The risk is "too many cooks": the agent can't tell which orchestrator owns which step, the user sees inconsistent behavior depending on which trigger fires first, and small operational decisions (model selection, commit splitting) get made in two places.

## Decision

**`/start-workflow` is the single command center for ticket-granularity work.** Every other layer is called as a sub-step from inside `/start-workflow`, not as an independent autonomous trigger.

The intended call graph for a typical request is:

```
/start-workflow
├── 1. clarify (one focused question if needed)
├── 2. aegis_compile_context(target_files, plan)
│       → returns relevant rules/ADRs with relevance scores
├── 3. plan (delegate to superpowers:writing-plans if the work warrants it)
├── 4. ADR? (write docs/adr/NNNN-... if a non-obvious design decision exists)
├── 5. dispatch to general-purpose subagent (model: sonnet, per agents.md)
├── 6. parent reviews diff (Before-reporting-done pass from agents.md)
├── 7. /commit (split discipline)
└── 8. /pr (English summary + demo GIF)

Hooks (pre/post-tool, stop) fire automatically throughout — they are
enforcement, not orchestration, and need no explicit coordination.
Permission gates are the security floor — they apply everywhere.
```

**Layer roles, codified:**

- **Permissions / hooks**: enforcement only. Do not change them based on which orchestrator is active.
- **`@include` rules**: always-on baseline. Stay in `AGENTS.md` until aegis context overhead becomes the bottleneck.
- **aegis**: context narrowing. Used inside `start-workflow` step 2 — not invoked autonomously elsewhere.
- **superpowers**: methodology toolbox. Individual superpowers skills (`brainstorming`, `writing-plans`, `using-git-worktrees`, `test-driven-development`, etc.) are called explicitly from inside `start-workflow` when their step applies. Do not let superpowers auto-trigger as a parallel orchestrator — the project's `start-workflow` owns the sequence.
- **custom skills (`commit`, `pr`)**: prevail over any superpowers equivalent. They are empirically tuned for this project; do not use the marketplace replacements.
- **`start-workflow`**: the only orchestrator. Trivial work (one-line fixes, config tweaks, docs-only changes) skips this entirely and is handled directly in the parent.

When `start-workflow` and a superpowers skill describe the same step (e.g., planning), `start-workflow`'s sequence is authoritative; superpowers' skill is a tool the parent may use to execute the step, not a parallel decision-maker.

## Alternatives considered

- **Adopt superpowers as the orchestrator and remove `start-workflow`**: rejected. Superpowers' skills auto-trigger based on the LLM's interpretation of `description` fields, which is empirically unreliable (the same problem that killed the `self-review` skill in this project). An explicit single entry point is more predictable.

- **Drop `@include` rules and rely entirely on aegis**: rejected for now. The current rule set is small enough that always-loading is cheaper than the round-trip cost of compiling context for every interaction. Reconsider when rule count exceeds ~15 or when context bloat becomes measurable.

- **Skip `start-workflow` and let aegis + superpowers self-coordinate**: rejected. There is no shared protocol between them; both will think they own the planning step, and the user sees whichever trigger fires first.

- **Build a `/start-workflow` so heavyweight that it replaces superpowers entirely**: rejected. Superpowers' skills are well-tested and cover ground the project would have to re-solve (worktree setup, TDD enforcement). Use them as building blocks, don't reinvent.

## Consequences

- **One mental model for the user**: `/start-workflow` for real work, direct interaction for trivial. No "which entry point do I use?" question.
- **One mental model for the agent**: every ticket-granularity request enters through `start-workflow`; the agent does not need to predict whether superpowers or aegis will trigger first.
- **Layer boundaries stay clean**: enforcement layers (permissions, hooks) are policy, not flow. Orchestration layers (start-workflow, aegis, superpowers, custom skills) have a clear hierarchy.
- **Cost**: superpowers' value-add depends on it being explicitly called from `start-workflow`. If a future agent forgets to use it, the project loses superpowers' methodology benefits without noticing — this is detectable through observation (compile_miss-style feedback) but requires periodic review.
- **`start-workflow` becomes load-bearing.** Changes to it need empirical tuning (`empirical-prompt-tuning` skill) before they ship, because every ticket-granularity task flows through it.
- **Migration path is preserved**: if aegis or superpowers proves more reliable than expected, this decision can be reversed by editing `start-workflow` and superseding this ADR. The dependency goes one way (start-workflow → aegis / superpowers), so peeling layers is feasible.
