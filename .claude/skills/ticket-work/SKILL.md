---
name: ticket-work
description: The seven-step sequence for ticket-granularity work — implement a component, fix a non-trivial bug, refactor a module, add a feature. Invoke at the start of such work.
---

# Ticket work

1. **Clarify.** Resolve ambiguous acceptance criteria or constraints from the codebase, the assets, or git history. If that fails, ask **one** question — whichever ambiguity blocks the most work. Not a checklist.
2. **Judge the design.** Creative or architectural work — new UI, a new pattern, a choice between credible alternatives — is proposed with its alternatives and implemented only after the user approves.
3. **Plan.** One sentence of goal, the files to create or edit with one line each, the acceptance criteria, and the verification commands (`bun run typecheck` / `bun run check` / `bun run test` / build / manual smoke test, as applicable). Enter plan mode when the user asked for a plan.
4. **Spec the interaction, when it is complex.** Wizards and multi-step forms, auth or session flows, async guards, permission branching: write `specs/<feature>.spec.md` in the format the `verify-spec` skill defines, dispatch the `spec-verifier` agent on it, and fix the design for every CONFIRMED counterexample. The deciding factor is interaction complexity, not scale.
5. **Implement.** The parent implements directly; delegate only to keep an investigation's raw output out of its context, or to run independent units at once. The tests that go with what you add follow AGENTS.md's Testing section. When debugging, reproduce the failure and check what changed recently before forming a hypothesis, then test that hypothesis with the smallest possible change — never try changes to see which one sticks.
6. **Self-check.** Read the full diff. Run `bun run typecheck`, `bun run check` and `bun run test`, fixing every error. Confirm step 3's acceptance criteria — reading the diff yourself for anything a subagent implemented, not its summary.
7. **Review, then commit.** Dispatch the `code-reviewer` agent on the uncommitted diff, apply the fix each finding returns, and ask the user where one needs a decision. Then propose the commit split and wait for the user.
