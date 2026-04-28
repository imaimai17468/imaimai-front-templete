# 0002. `bun audit` blocks only on direct-dep vulnerabilities

- Status: accepted
- Date: 2026-04-24

## Context

Adding `bun audit` to CI surfaced 60 vulnerabilities across direct and transitive dependencies. Direct ones (e.g., outdated `drizzle-orm` with a SQL injection advisory) are fixable by version bumps. Transitive ones (`tar`, `fast-xml-parser`, `undici`, etc., reachable through `@aws-sdk`, `wrangler`, `vitest`) cannot be patched without `package.json` `overrides`.

A first attempt added 13 `overrides` entries to silence the audit. This achieved a clean audit but introduced significant maintenance debt:

- Each override is a manual patch unrelated to product intent
- Dependabot does not track override-pinned versions
- Major-version overrides on transitive deps (e.g., `fast-xml-parser` 4 → 5 inside `@aws-sdk`) carry runtime risk that build-time tests can't catch
- Overrides leak to projects derived from this template, polluting their dependency graph with patches they may not need

## Decision

The CI gate fails only on vulnerabilities in **direct** `dependencies` / `devDependencies`. Transitive vulnerabilities are reported as informational and tolerated until upstream releases catch up. The check is implemented in `scripts/audit-direct.sh`, which intersects `bun audit --json` output with the direct-dep keys from `package.json`.

`overrides` is not used.

## Alternatives considered

- **Keep `overrides` and block on all severities**: rejected — high maintenance cost, runtime risk from forced major bumps, template pollution.
- **`bun audit --audit-level=high`**: rejected — still flags transitive issues we can't patch, and ignores low/moderate direct-dep findings we'd want to see.
- **`continue-on-error: true` on the audit step**: rejected — reduces audit to a warning humans will eventually ignore. Direct-dep findings should hard-block.
- **`npm audit signatures` / supply-chain provenance verification**: not yet — Bun does not surface a comparable check at parity, and it overlaps with what Socket.dev (separate decision) covers.

## Consequences

- Direct deps stay clean and force timely upgrades when advisories drop.
- Transitive vulnerabilities ride until the responsible direct dep updates its pin. Operationally this means roughly weekly attention via Dependabot PRs.
- The script is the source of truth for "what counts as a blocker"; future tightening (severity threshold, allowlist by CVE) edits one file.
- Derivative projects inherit the same boundary without any per-project tweaks.
