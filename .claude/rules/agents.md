# Agent Dispatch

## Audience: parent only

The dispatch / delegation rules below apply to the **parent session**. If you are reading this rule from inside a dispatched subagent invocation (your top-level task came in as a briefing from a parent), ignore the "dispatch to subagent" guidance — *you* are the dispatched agent, and your job is to execute the briefing directly using `Edit` / `Write` / `Bash`. Do not attempt to dispatch further subagents (the `Agent` tool is typically not available to you, and re-dispatching from a subagent would create infinite recursion).

How to tell which side you are on:

- **You are the parent** if the user prompt is a free-form chat message (typical interactive turn).
- **You are a subagent** if the user prompt is a long, structured briefing that names you as the executor and lists files / acceptance criteria. In that case, follow only the rules below that apply to "the subagent" (mostly the *Before reporting done* section).

## Delegation default (parent)

Tasks at the granularity of "implement a component", "fix a bug", or "refactor this module" should be **dispatched to subagents** rather than implemented in the parent session. The parent does not write implementation code — it **decomposes, orchestrates, verifies, and commits**.

The parent's job is:

1. Gather requirements and relevant context (`AGENTS.md`, related files, acceptance criteria).
2. **Decompose the work into the optimal set of subagents** (see *Team decomposition* below) — do **not** default to a single agent. Split the task into the smallest independent units that can run in parallel, and identify which units must run sequentially because of dependencies.
3. Write a self-contained briefing per unit.
4. Dispatch: independent units **in parallel** (multiple `Agent` calls in one message); dependent units **sequentially** (downstream dispatched after upstream returns).
5. Verify each returned diff and summary; integrate.
6. Handle commit / PR.

Exception: trivial one-liners, typo fixes, and config tweaks are done directly in the parent — dispatch overhead isn't worth it. And a task that is genuinely one indivisible unit is a single subagent — decomposition means "split when splitting helps," not "always split."

## Before each dispatch — Aegis is mandatory

**Every** subagent dispatch MUST be preceded by a fresh `aegis_compile_context` call whose `target_files` and `plan` reflect the briefing you are about to send. One call per session is NOT enough — Aegis must be re-consulted whenever the target file set or the intent changes (i.e., before every `Agent` tool call). The returned guidelines MUST be quoted into the briefing so the subagent does not need to re-derive them.

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

## Team decomposition (parallel vs sequential)

The parent must **actively decide how to split ticket work into a team of subagents** and run the independent parts in parallel. This is the default posture for multi-part work — not a rare exception. Reaching for a single subagent without first checking whether the work decomposes is a mistake.

How to decompose:

1. **List the work units.** Break the task into the smallest pieces that each have a clear, self-contained briefing (e.g., "DB schema + gateway", "component A", "wire A into pages", "docs").
2. **Build the dependency graph.** For each pair of units, ask two questions:
   - *Shared files?* Do they edit the same file(s)?
   - *Output dependency?* Does one need the other's result (types, APIs, components, migrations) written first?
3. **Decide parallel vs sequential:**
   - **Both answers "no" → independent → run in PARALLEL** (multiple `Agent` calls in a single message, or an agent team).
   - **Either answer "yes" → dependent → run SEQUENTIALLY** (downstream dispatched after upstream returns), or merge the two into one unit.
4. **Never parallelize units that edit the same file** — concurrent edits conflict and silently clobber each other. If two otherwise-parallel units would touch one shared file, give exactly one unit ownership of it, or sequence them.

Lean toward maximizing the parallel frontier: at each stage, dispatch every currently-unblocked independent unit at once, then sequence only across genuine dependency edges. A typical layered feature (backend → component → integration) is a sequential spine, but independent siblings within a layer (e.g., two unrelated components, or backend + an unrelated doc) should fan out in parallel.

Use `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` (a real team) for genuine simultaneous collaboration on one effort needing shared coordination; use plain parallel `Agent` dispatches for independent fan-out. Either way, the decision rule above governs what runs together. A single subagent is correct only when the work is genuinely one indivisible unit.

Each unit still follows every other rule here: a fresh `aegis_compile_context` before each dispatch, an explicit `model`, and the *Before reporting done* review pass.

## Before reporting done

For multi-file implementations, added branches, or new pure functions: re-read the diff once more before declaring done. Look for missing test coverage on new branches, dead code / over-abstraction that the task didn't require, and null/undefined/off-by-one/async bug patterns types can't catch. Fix, then verify with `bun run typecheck` / `bun run test`. Coding-rule conformance is handled by the stop hook — this pass is for the quality concerns above only. Skip the pass entirely for one-liners, config-only, or docs-only changes.

After self-review, **invoke `Skill("superpowers:requesting-code-review")` and run an independent reviewer pass** before claiming the work is complete. Self-review alone is not enough for ticket-granularity work: the reviewer must be a fresh agent without your context so it can spot blind spots, missed regressions, and conventions you forgot to apply. Only mark the work as done after the reviewer's findings have been addressed (or explicitly justified as out of scope).

Skip the independent review only for the same trivial scope where the self-review pass is skipped (one-liner / config-only / docs-only). Anything that touches more than one file, adds a new branch, or introduces a new pure function MUST go through review.

### Handling review findings (parent)

When the reviewer (or the user) reports findings, the parent MUST NOT dismiss them without verification:

- **Never assume "pre-existing"**: If the finding targets a file in the diff, the change introduced or surfaced it. Do not dismiss it as someone else's problem.
- **Apply rules literally**: If a coding rule says "name booleans by purpose," apply it to every boolean in the diff — props, options, state, return values. Do not narrow the rule's scope by analogy or interpretation.
- **When in doubt, fix**: If unsure whether a finding is valid, fix it. The cost of an unnecessary minor fix is far lower than the cost of arguing incorrectly and eroding trust.

### Review quality (reviewer)

Reviewers MUST follow these rules when reporting findings:

- **No finding without a concrete alternative.** Every violation report must include a specific code change or refactoring step the author can apply. "Remove internal `useState`" is not actionable if the reviewer cannot explain where the state should live instead. If you cannot propose a better design, do not report the finding.
- **Read the full rule, not just the heading.** If a rule has scope qualifiers (e.g., "Applies to Presenters only"), respect them. Do not apply the rule to code that falls outside its stated scope.
- **Do not re-report dismissed findings.** If a finding was already reviewed and justified as out of scope or a false positive, do not raise the same finding again on subsequent attempts.
