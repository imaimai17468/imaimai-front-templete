---
name: repo-audit
description: On-demand repo-wide audit with the best available model — hunts what deterministic gates cannot (architecture drift vs ADRs, security posture, dependency strategy, doc staleness/DX) and routes outcomes into existing rails (ADR/AGENTS.md via aegis-share, or a plan doc in docs/superpowers/specs/). Use when the user asks for a repo audit, health check, or "what should we improve"; not scheduled, not CI-run.
user_invocable: true
---

# Repo Audit

Best-model judgment, cheap-model legwork, existing artifact rails (ADR-0014).
The value is the synthesis in the strongest available context — if the
session model is weak, say so and recommend re-running on a stronger one
(AGENTS.md, Model continuity).

## Lanes (only what gates cannot catch)

1. **architecture-drift** — code vs `docs/adr/` decisions and AGENTS.md rules
2. **security-posture** — permissions, secrets handling, injection surfaces,
   supply chain (direct deps only, per ADR-0002)
3. **dependency-strategy** — staleness, dead deps, risky pins (not CVE
   lists — `bun audit` owns those)
4. **docs-dx** — stale or contradictory docs, onboarding friction, missing
   runbooks

Lint, types, tests, dead code, and formatting are OUT of scope — hooks and
CI gates own them.

## Procedure

1. `aegis_compile_context` (or the degraded path) with representative files
   per lane; the returned ADRs are the audit's reference rules (drift in
   lane 1 is measured against them).
2. Fan out one read-only Explore subagent per lane (`model: haiku`; `sonnet`
   when precision matters). Prompts must be self-contained and forbid edits.
3. Synthesize in the parent: keep only findings that are actionable and not
   already gate-covered; drop anything an existing ADR already decides
   (cite it instead). Present kept findings as a table with **severity
   (High/Medium/Low) and effort (S/M/L)** columns, ordered by **leverage**
   — a judgment ranking of impact relative to effort, no numeric formula:
   a Medium/S outranks a High/L. Exception: High-severity security findings
   are always placed first regardless of effort (independently of this
   ordering rule, they also trigger the Escalation reporting in step 4).
   The full table appears in the audit summary to the user; when Work items
   are filed, the plan doc opens with the subset of rows filed in it.
   Borrowed from shadcn/improve's vetting step.
4. Route every kept finding — never invent a new format:
   - **Knowledge** (rule / convention / decision) → ADR draft or AGENTS.md
     edit → aegis-share flow (source + edges → format → lint → materialize
     → export).
   - **Work** (something to fix or build) → plan doc in
     `docs/superpowers/specs/` for a later `/start-workflow` execution.
   - **Escalation**: a High-severity security finding is ALSO reported to
     the user immediately in the audit summary with a proposal to run
     `/start-workflow` on it right away — filing it in a plan doc alone is
     not sufficient.
5. Record at the end of the produced doc(s): date, model used, lanes run,
   total subagent tokens, and the **baseline commit** (`git rev-parse
   --short HEAD`) the audit examined. Whoever later executes a plan doc
   MUST diff that baseline against current HEAD first — if the touched
   files changed since, re-verify the finding before acting on it (drift
   check, borrowed from shadcn/improve's plan stamping). If nothing new:
   report "nothing new" to the user and write NOTHING.

## Retention rule

If two consecutive audits produce nothing actionable, propose deleting this
skill (ADR-0011's code-graph lesson: measured-useless features are removed).
