# 0001. Coding rules live in `.claude/rules/` and load via `AGENTS.md` `@include`

- Status: accepted
- Date: 2026-04-23

## Context

The repository needed a place to record coding conventions (style, architecture, testing, dependencies, agent dispatch policy, tools) that AI coding agents would actually follow.

Claude Code offers two surfaces for project-scoped guidance:

- **Skills** at `.claude/skills/<name>/SKILL.md`: invoked on demand, either explicitly (`/skill-name`) or autonomously based on a `description`-defined trigger.
- **Always-on rules** loaded through `CLAUDE.md` / `AGENTS.md` `@include` directives.

The first iteration packed all coding rules into a `coding-guide` skill. In practice this meant the rules were only consulted when the agent decided to look — and that decision was unreliable. Meanwhile `AGENTS.md` carried a duplicated, summarized version of the same rules, creating maintenance drift.

## Decision

Coding rules live as one file per topic under `.claude/rules/` and are loaded into every session via explicit `@.claude/rules/<topic>.md` lines in `AGENTS.md`. The `coding-guide` skill is removed.

Files: `style.md`, `architecture.md`, `testing.md`, `dependencies.md`, `tools.md`, `agents.md`.

`AGENTS.md` becomes a thin shell — a one-paragraph orientation note plus the `@include` list — so the source of truth is the rule files themselves.

## Alternatives considered

- **Keep the `coding-guide` skill**: rejected because skill invocation is unreliable, and the skill duplicated content already condensed in `AGENTS.md`.
- **Inline all rules directly into `AGENTS.md`**: rejected because the file would balloon past comfortable length, and per-topic editing would touch one large file instead of small focused files.
- **Use a dedicated marketplace / framework (e.g., aegis, superpowers)**: rejected for now — too few rule files to justify the runtime / setup cost. Reconsider when rule count exceeds ~15 or per-file-path scoping is needed.

## Consequences

- Rules apply on every session start without agent action — no missed-trigger failure mode.
- Each rule is one focused file, so edits are surgical and diffs are readable.
- The `stop-agent-review.sh` hook reads from `.claude/rules/*.md` directly, keeping enforcement aligned with the source of truth.
- Cost: every session pays the token weight of the full rule set even when rules aren't relevant to the current task. Acceptable while the rule set is small.
