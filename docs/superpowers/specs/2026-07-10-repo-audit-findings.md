# Repo audit findings — 2026-07-10

- Audit run: `repo-audit` skill, first run (ADR-0014).
- Model: parent Fable (synthesis) + 4 read-only Explore lanes (sonnet ×3,
  haiku ×1). Total subagent tokens ≈ 84k.
- Lanes: architecture-drift, security-posture, dependency-strategy, docs-dx.

Findings below are **Explore output, not adversarially verified** — each is
a candidate to confirm before execution (via `/start-workflow` for the Work
findings W1–W6; via the aegis-share ADR flow for the Knowledge finding K1),
not a settled defect. Two docs findings that pointed at artifacts created on the
same branch (repo-audit undocumented in `docs/agent-workflow.md`; the ADR-0014
eval requirement not reflected there) were fixed directly on that branch and
are not listed here.

## Routed to knowledge (ADR amendment)

### K1. ADR-0007 describes a Nitro deployment mechanism the code no longer uses
The project deploys via `@cloudflare/vite-plugin` (`vite.config.ts`,
`wrangler.toml#main = ./src/ssr.tsx`, `getCloudflareEnv()` importing
`cloudflare:workers`), but ADR-0007's Decision/Consequences still describe a
Nitro `cloudflare-module` preset (`.output/server/index.mjs`, `[assets]`
section, `getEvent().context.cloudflare.env`). TanStack Start's Cloudflare
integration changed after the ADR was written and the text was never amended.
`.gitignore` still lists `.output/` (dead). **Route:** amend ADR-0007 (or a
new superseding ADR) to document the actual `@cloudflare/vite-plugin`
mechanism, then aegis-share sync. Verify first: confirm no Nitro path remains
intended.

## Routed to work (plan docs / `/start-workflow`)

### W1. Stored-XSS via client-controlled avatar Content-Type (highest priority)
`updateUserAvatar` uploads with `file.type` (client-supplied, spoofable) as
the R2 `httpMetadata.contentType`, and `src/routes/api/avatars.ts` serves it
back verbatim with no MIME allow-list, no `X-Content-Type-Options: nosniff`,
and no CSP. An attacker can upload `text/html` or `image/svg+xml` and have it
served same-origin → stored XSS. **Fix direction:** allow-list image MIME
types on upload; set `nosniff` on the avatars response; consider serving from
a separate origin/path. Files: `src/gateways/user/index.ts:64`,
`src/lib/storage/r2.ts:3`, `src/routes/api/avatars.ts:19`.

### W2. Unauthenticated, unvalidated R2 read (IDOR) on avatars endpoint
`GET /api/avatars` takes `key` from the query string with no format
validation and no session check, then reads the bucket directly — any object
is fetchable by key enumeration. Avatars may be intended public, but the key
is unconstrained (not pinned to `${userId}/avatar.*`). **Fix direction:**
validate the key shape and/or scope reads to the caller's own prefix. File:
`src/routes/api/avatars.ts:7`. Verify intent (public avatars?) before fixing.

### W3. Next.js-era auth env leftover breaks fresh-clone OAuth setup
`.env.local.example:3` and `docs/DATABASE_SETUP.md:49,117-119` use
`NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:8787` and tell users to register
Google OAuth redirects at :8787. The app is TanStack Start (not Next.js), the
`NEXT_PUBLIC_` var is read nowhere, and the real dev URL is `:5173`
(`wrangler.toml#BETTER_AUTH_URL`, README). A fresh clone would register the
wrong callback. **Fix direction:** drop the `NEXT_PUBLIC_` var, correct the
port to 5173 in the example and DATABASE_SETUP.md.

### W4. `react-doctor` skill references a nonexistent `doctor-explain` skill
`.claude/skills/react-doctor/SKILL.md` points at a `doctor-explain` skill
(alias `/doctor-config`) that exists nowhere in the repo or installed plugins.
**Fix direction:** remove the dead reference or inline the guidance.

### W5. `lucide-react` is a full major behind (0.525 → 1.24)
Pre-1.0 pin; a stable 1.x exists. Actively used across components. **Fix
direction:** evaluate the 1.x migration as a deliberate bump (not routine
Dependabot churn). Low urgency.

### W6. README Scripts table omits `check` / `check:fix` / `lint:fix` / `generate-routes`
`bun run check` (lint+format, mirrored by the lefthook pre-push hook) is the
combined command developers rely on but it is undocumented. **Fix direction:**
add the missing rows to the README Scripts table. Low urgency.

## Not findings (verified clean by the lanes)

Permissions vs ADR-0004/0013, hook determinism vs ADR-0013, skills/agents vs
ADR-0011/0012/0014, `scripts/audit-direct.sh` vs ADR-0002, SQL
parameterization, server-function auth gating, hardcoded secrets, direct-dep
vulnerabilities, `.gitignore` for `.env*`/`.wrangler`/`worker-configuration.d.ts`.
(One low/preventive note: `.dev.vars` — Wrangler's local-secrets file — is not
covered by the `.env*` glob; add it to `.gitignore` if the team uses that
convention. Folded here rather than as a work item.)
