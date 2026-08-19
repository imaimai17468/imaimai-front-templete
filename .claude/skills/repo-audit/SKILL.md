---
name: repo-audit
description: On-demand repo-wide audit with the best available model — hunts what deterministic gates cannot (drift from the documented conventions, security posture, dependency strategy, doc staleness/DX) and routes outcomes into existing rails (AGENTS.md or the path-scoped rules for conventions; work findings are reported to the user rather than persisted). Use when the user asks for a repo audit, health check, or "what should we improve"; not scheduled, not CI-run.
user_invocable: true
---

# Repo Audit

Best-model judgment, cheap-model legwork, existing artifact rails.
The value is the synthesis in the strongest available context — if the
session model is weak, say so and recommend re-running on a stronger one
(AGENTS.md, Model continuity).

## Lanes (only what gates cannot catch)

1. **convention-drift** — code vs AGENTS.md and the path-scoped rules under
   `.claude/rules/`, plus the layering the `arch-rules` lint plugin encodes
2. **security-posture** — permissions, secrets handling, injection surfaces,
   supply chain (`scripts/audit-direct.sh` gates direct deps only)
3. **dependency-strategy** — staleness, dead deps, risky pins (not CVE
   lists — `bun audit` owns those)
4. **docs-dx** — stale or contradictory docs, onboarding friction, missing
   runbooks

Lint, types, tests, dead code, and formatting are OUT of scope — hooks and
CI gates own them.

## Procedure

1. Read `AGENTS.md` and the path-scoped rule files under `.claude/rules/`
   whose scope matches the lanes being run; those are the audit's reference
   rules, and drift in lane 1 is measured against them.
2. Fan out one read-only Explore subagent per lane (`model: haiku`; `sonnet`
   when precision matters). Prompts must be self-contained and forbid edits.
3. Synthesize in the parent: keep only findings that are actionable and not
   already gate-covered; drop anything AGENTS.md or a rule file already
   decides (quote it instead). Present kept findings as a table with **severity
   (High/Medium/Low) and effort (S/M/L)** columns, ordered by **leverage**
   — a judgment ranking of impact relative to effort, no numeric formula:
   a Medium/S outranks a High/L. Exception: High-severity security findings
   are always placed first regardless of effort (independently of this
   ordering rule, they also trigger the Escalation reporting in step 4).
   The full table appears in the audit summary to the user, which opens with
   the subset of rows filed as Work items.
   Borrowed from shadcn/improve's vetting step.
4. Route every kept finding — never invent a new format:
   - **Knowledge** (rule / convention) → an edit to `AGENTS.md` or to the
     path-scoped rule file whose scope it falls under. Nothing else records
     conventions.
   - **Work** (something to fix or build) → reported to the user in the audit
     summary, to run through the AGENTS.md Workflow sequence if they want it.
     There is no plan artifact.
   - **Escalation**: a High-severity security finding is ALSO reported to the
     user immediately in the audit summary, with a proposal to start work on
     it right away rather than leaving it in a summary.
5. Record at the end of the produced doc(s): date, model used, lanes run,
   total subagent tokens, and the **baseline commit** (`git rev-parse
   --short HEAD`) the audit examined. Whoever later acts on a filed Work item
   MUST diff that baseline against current HEAD first — if the touched
   files changed since, re-verify the finding before acting on it (drift
   check, borrowed from shadcn/improve's plan stamping). If nothing new:
   report "nothing new" to the user and write NOTHING.

## Retention rule

If two consecutive audits produce nothing actionable, propose deleting this
skill. A feature measured useless gets removed rather than kept for its idea.
