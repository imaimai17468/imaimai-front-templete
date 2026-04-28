# Architecture Decision Records

Long-lived rationale records for non-obvious decisions. Plans / commit messages capture *what* changed; ADRs capture **why** the team chose this path over alternatives, so future readers can re-litigate the decision when context shifts.

## When to write an ADR

Write one when **all** of the following apply:

- The decision is hard to reverse without coordinated effort
- The right answer wasn't obvious — there were credible alternatives
- The reason will be forgotten within 6 months without writing it down

If a future reader can re-derive the decision from the code or commit message alone, no ADR needed.

## Format

Use MADR-lite. Each ADR is one Markdown file at `docs/adr/NNNN-kebab-title.md` with this skeleton:

```markdown
# NNNN. Title

- Status: proposed | accepted | superseded by NNNN | deprecated
- Date: YYYY-MM-DD

## Context

What problem are we solving? What constraints / forces apply?

## Decision

What did we decide? One paragraph, declarative.

## Alternatives considered

- **Alt A**: why rejected
- **Alt B**: why rejected

## Consequences

What does this make easier? Harder? What follow-up is implied?
```

Keep each ADR under ~80 lines. If it's getting longer, split it.

## Numbering

Strictly sequential, zero-padded to 4 digits. Never renumber. When an ADR is superseded, mark old as `superseded by NNNN` and create a new one — do not edit the old decision in place.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-coding-rules-via-claude-rules-include.md) | Coding rules live in `.claude/rules/` and load via `AGENTS.md` `@include` | accepted |
| [0002](0002-direct-deps-only-audit.md) | `bun audit` blocks only on direct-dep vulnerabilities | accepted |
| [0003](0003-subagent-driven-implementation.md) | Ticket-granularity implementation is delegated to subagents | accepted |
| [0004](0004-permission-deny-as-security-boundary.md) | `permissions.deny` is the security boundary, not `ask` | accepted |
| [0005](0005-wrangler-types-for-cloudflare-env.md) | Generate `CloudflareEnv` via `wrangler types`, not hand-written | accepted |
| [0006](0006-orchestration-layering.md) | `/start-workflow` is the single orchestration entry; aegis / superpowers / custom skills are sub-steps | accepted |
