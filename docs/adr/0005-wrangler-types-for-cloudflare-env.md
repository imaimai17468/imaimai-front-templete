# 0005. Generate `CloudflareEnv` via `wrangler types`, not hand-written

- Status: accepted
- Date: 2026-04-23

## Context

The `getCloudflareContext().env` object's shape (D1 / R2 / KV / vars) is dictated by `wrangler.toml`. Originally `src/env.d.ts` declared a hand-maintained `CloudflareEnv` interface mirroring those bindings.

The hand-maintained file is silently desynchronized whenever `wrangler.toml` adds or renames a binding. Type errors only surface at the call site, often far from the change.

`wrangler types` generates a `worker-configuration.d.ts` directly from `wrangler.toml`, producing a `CloudflareEnv` interface that is guaranteed to match the actual bindings (plus the workerd runtime types).

## Decision

Drop hand-maintained `src/env.d.ts`. Add `cf-typegen` script (`wrangler types --env-interface CloudflareEnv`) and gitignore the output `worker-configuration.d.ts`. Whenever `wrangler.toml` changes, run `bun run cf-typegen` to regenerate.

The generated file lives at the project root and is picked up automatically by the existing `tsconfig.json` `**/*.ts` include glob — no additional config required.

## Alternatives considered

- **Keep `src/env.d.ts` hand-maintained**: rejected — silent drift between `wrangler.toml` and the type is too easy.
- **Commit `worker-configuration.d.ts`**: rejected — it's a generated artifact, large (>400 KB), and noisy in diffs. Treating generated files like committed source invites stale-on-clone bugs.
- **Hook `cf-typegen` into `bun install` or a postinstall script**: rejected — lifecycle scripts are off by default in Bun (see `trustedDependencies`), and adding them just for typegen invites supply-chain script execution we don't otherwise want. Manual regenerate is the explicit ergonomic.

## Consequences

- Adding a binding becomes a two-step ritual: edit `wrangler.toml`, run `bun run cf-typegen`. Forgetting step two surfaces immediately as a type error in any code that touches `env`.
- The generated file is large but not in the repo, so it doesn't hit code review.
- Onboarding a new collaborator requires they run `cf-typegen` once after clone — documented in `.claude/rules/tools.md`.
- The workerd runtime types come along for free, replacing any ad-hoc Cloudflare-runtime type imports.
