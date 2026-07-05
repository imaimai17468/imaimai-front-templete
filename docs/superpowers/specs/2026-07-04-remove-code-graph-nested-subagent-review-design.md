# Remove Code Graph, Replace Workflows with Nested Subagents

Date: 2026-07-04

## Context

Benchmarking showed that code graph injection provides no measurable token savings at the current project scale (51 files). The parallel multi-finder + multi-verifier architecture (5-7 finders × N verifiers) produces ~1.1M tokens per review-diff run, with finders independently finding the same bugs and each reading the same files redundantly.

### Benchmark Results

| Workflow | Config | Tokens | Agents | Tool Calls |
|---|---|---|---|---|
| verify-spec | graph off | 710,317 | 22 | 39 |
| verify-spec | graph on | 784,264 | 25 | 35 |
| review-diff | graph off | 1,109,404 | 28 | 202 |
| review-diff | graph on | 1,194,695 | 30 | 199 |

Key findings:
- Code graph added overhead without reducing tokens (graph on was consistently equal or worse)
- Parallel finders found duplicate bugs (dedup merged many `alsoFoundBy` entries)
- Tool call counts were nearly identical with/without graph (199 vs 202)
- A single comprehensive finder reading the diff once would produce equivalent results at ~1/5 the cost

## Decision

1. **Remove code graph entirely** — the feature, its build script, hooks, and all references.
2. **Replace dynamic workflows with nested subagent dispatch** — review-diff and verify-spec become orchestrator subagents that internally dispatch finder/verifier child agents.
3. **Consolidate parallel lanes into single agents** — 1 comprehensive finder + 1 comprehensive verifier replaces N parallel finders + N parallel verifiers.

## Architecture

### review-diff

```
Parent (session model)
  └─ Agent("review-diff orchestrator", model: sonnet)
       ├─ reads git diff + changed files
       ├─ Agent("finder", model: sonnet)
       │    all lenses: logic, state, integrity, cleanup, rules
       │    reads AGENTS.md + .claude/rules/ for rule violations
       │    returns: findings[] { file, line, title, description, severity }
       ├─ dedup + severity sort (orchestrator judges inline)
       ├─ Agent("verifier", model: sonnet)
       │    receives all findings, tries to REFUTE each
       │    reads actual code to trace failure scenarios
       │    returns: findings[] with CONFIRMED/PLAUSIBLE/REFUTED verdict
       ├─ filters REFUTED, sorts by severity
       ├─ touch .claude/.review-stamp (if finder + verifier both completed)
       └─ returns: { findings, stats, gateStamped }
```

Depth: 2 (parent → orchestrator → finder/verifier). Within AGENTS.md recommended ceiling.

### verify-spec

```
Parent (session model)
  └─ Agent("verify-spec orchestrator", model: sonnet)
       ├─ reads spec file + specs/README.md
       ├─ Agent("formalize", model: sonnet)
       │    normalizes spec into structured state machine
       │    flags ambiguities
       │    returns: { states, actions, invariants, forbiddenFlows, requirements, ambiguities }
       ├─ Agent("hunter", model: sonnet)
       │    all lenses: invariant, forbidden, liveness, refinement
       │    adversarial toolkit: back, reload, double-submit, concurrent tabs, etc.
       │    returns: counterexamples[] { property, trace, explanation, severity }
       ├─ Agent("verifier", model: sonnet)
       │    replays each trace step by step
       │    returns: counterexamples[] with CONFIRMED/PLAUSIBLE/REFUTED verdict
       ├─ filters REFUTED, sorts by severity
       └─ returns: { ambiguities, counterexamples, stats }
```

### Review Gate Lifecycle

| Event | Action |
|---|---|
| `aegis_compile_context` called | delete `.review-stamp` (existing hook) |
| review-diff orchestrator completes successfully | create `.review-stamp` (orchestrator touches directly) |
| code-reviewer agent dispatch completes | create `.review-stamp` (existing fallback hook) |
| `git commit` attempted | `pre-commit-guard.sh` checks `.review-stamp` exists |

### Estimated Cost

| | Current (workflow) | New (nested subagent) | Reduction |
|---|---|---|---|
| review-diff | ~1.1M tokens, 28 agents | ~200-300K tokens, 3 agents | ~75-80% |
| verify-spec | ~800K tokens, 25 agents | ~200-300K tokens, 4 agents | ~63-75% |

## Files to Delete

- `.claude/code-graph.json`
- `.claude/workflows/review-diff.js`
- `.claude/workflows/verify-spec.js`
- `.claude/workflows/bench-code-graph.js`
- `scripts/build-graph.ts`
- `.claude/hooks/pre-workflow-clear-review-stamp.sh`
- `docs/superpowers/specs/2026-07-03-code-graph-workflow-integration-design.md`

## Files to Modify

- `package.json` — remove `graph` script
- `.gitattributes` — remove `code-graph.json -diff` line
- `.claude/hooks/pre-commit-guard.sh` — remove graph regeneration logic, keep review gate check only
- `.claude/settings.json` — remove Workflow-related hook entries, update pre-commit hook reference
- `AGENTS.md` — remove Code Graph section, rewrite Review section for nested subagent pattern
- `docs/agent-workflow.md` — remove code graph section, rewrite workflow details for nested subagent
- `docs/adr/README.md` — if code-graph ADR exists, mark superseded

## Dispatch Pattern (for AGENTS.md)

The parent dispatches the orchestrator with a self-contained prompt. The prompt includes:
- The task (review the uncommitted diff / verify a spec)
- The acceptance criteria (what to return)
- The dispatch pattern (which child agents to create, in what order)
- The fail-closed rule (if any child fails, report incomplete, don't stamp)

No skill file needed — the dispatch pattern lives in AGENTS.md's Review section. The `start-workflow` skill references it.

## Risks

- **LLM-driven dedup is non-deterministic** — the orchestrator may merge or keep findings differently across runs. Acceptable tradeoff: JS dedup was key-based (`file:line`) which also merged genuinely distinct findings at the same line.
- **Single finder may miss bugs that lane specialization would catch** — mitigated by listing all lenses in the prompt. Benchmark showed parallel finders found the same bugs redundantly.
- **Orchestrator prompt is long** — must include all lenses, rules references, output format. Manageable at ~2-3K tokens.
