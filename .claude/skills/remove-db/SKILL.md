---
name: remove-db
description: Use when forking this template for a project that does not need a database, auth, or file storage — removes Cloudflare D1 / R2 / Better Auth / Drizzle ORM. The Cloudflare Workers deployment stays intact.
user_invocable: true
---

# Remove DB / Auth / Storage

Strips the template down to a frontend-only TanStack Start app by removing:

- Cloudflare D1 + Drizzle ORM (database)
- Cloudflare R2 (avatar storage)
- Better Auth (Google OAuth)

**The Cloudflare Workers deployment is deliberately kept.** `wrangler.toml`,
`src/ssr.tsx`, the `@cloudflare/vite-plugin` wiring, `wrangler`, and the
`deploy` / `preview` / `cf-typegen` scripts all stay, so `bun run deploy` keeps
working the moment this procedure finishes. Only the *bindings* (D1, R2) and the
auth vars leave `wrangler.toml`. Removing D1 and removing the hosting platform
are separate concerns; this skill does the first one only.

What else stays: the app shell, shared UI (`src/components/ui`, header,
mode-toggle, theme-provider), the sample home page, and the oxlint / oxfmt /
tsc / knip / vitest toolchain.

## Preconditions

- `git status` is clean; work on a dedicated branch (the change set is large).

## 1. Delete source code

```bash
rm -rf src/lib/auth src/lib/drizzle src/lib/storage
rm -rf src/entities src/gateways src/server
rm -rf src/routes/api
rm -f src/routes/login.tsx src/routes/profile.tsx src/routes/auth.auth-code-error.tsx
rm -rf src/components/features/profile-page
rmdir src/components/features 2>/dev/null || true
rm -rf src/components/shared/header/auth-navigation src/components/shared/header/user-menu
rm -f src/test/cloudflare-workers-stub.ts
```

`src/routeTree.gen.ts` is gitignored and generated — refresh it with
`bun run generate-routes` after deleting route files.

Two things above are easy to misread as deployment removals; they are not:

- `src/server/` contains `cloudflare.ts`, whose only job is
  `import { env } from "cloudflare:workers"` to hand out the D1 / R2 / secret
  bindings. With no bindings left it has no callers. The Worker itself does not
  need it.
- `src/test/cloudflare-workers-stub.ts` exists *only* to satisfy the vitest
  alias for that import (step 3). It goes with it.

**Do not delete `src/ssr.tsx`.** It is the Worker entry that `wrangler.toml#main`
points at (ADR-0007). It calls `createStartHandler` and touches no binding, so
it survives this procedure untouched — including its
`satisfies ExportedHandler<CloudflareEnv>` annotation, which still typechecks
after every binding is gone (`wrangler types` emits an empty `CloudflareEnv`
interface rather than omitting it — verified, not assumed).

## 2. Fix auth-dependent UI

### `src/components/shared/header/Header.tsx`

Remove the `user` prop, the `UserWithEmail` / `AuthNavigation` imports, and the
`similarity-ignore` comment:

```tsx
import { Link } from "@tanstack/react-router";
import { ModeToggle } from "@/components/shared/mode-toggle/ModeToggle";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-transparent backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-6">
        <div>
          <h1 className="font-medium text-2xl">
            <Link to="/">Title</Link>
          </h1>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/" className="text-gray-400 text-sm">
            Link1
          </Link>
          <Link to="/" className="text-gray-400 text-sm">
            Link2
          </Link>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
};
```

### `src/routes/__root.tsx`

- Delete the `getCurrentUserFn` import and the `loader` option.
- Delete `const { user } = Route.useLoaderData();` and render `<Header />` without props.

### `src/routes/index.tsx`

The sample home page hardcodes the stack and setup commands. Remove the
`Better Auth` and `Drizzle ORM` entries from the `STACK` array, and drop the
`cp .env.local.example .env.local` line from the "Get started" code snippet (the
env example file is deleted in step 4). Note: the step 7 residual grep will
**not** catch these — `"Better Auth"` has a space and `"Drizzle ORM"` is
capitalized, neither matches the `better-auth` / `drizzle` (lowercase,
case-sensitive) patterns — so fix them here explicitly.

### Residual auth references

```bash
grep -rn "signIn\|signOut\|session\|getCurrentUserFn\|AuthNavigation\|UserMenu\|UserWithEmail" src/
```

Remove every hit individually.

## 3. Update build / test config

`vite.config.ts` needs **no change** — the `cloudflare()` plugin is what builds
the Worker, and it stays.

### `vitest.config.mts` — drop the `cloudflare:workers` alias

The alias only existed to stub that import for `src/server/cloudflare.ts`, which
step 1 deleted. Remove the `alias` block and the now-unused `node:path` import:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    isolate: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

### `knip.json`

- Remove `"src/server/fn/**/*.ts"` from `entry`.
- Remove `"src/server/cloudflare.ts"` from `ignore`.

## 4. Config files

### `wrangler.toml` — edit, do not delete

Delete the `[[d1_databases]]` and `[[r2_buckets]]` blocks and the
`BETTER_AUTH_URL` entry under `[vars]` (drop `[vars]` entirely if it becomes
empty). Keep `name`, `main`, `compatibility_date`, and `compatibility_flags`.

Leave `compatibility_flags = ["nodejs_compat"]` in place unless you have
verified nothing in the remaining build needs it — it is cheap to keep and
removing it on a hunch is how a deploy breaks in production rather than locally.

Then regenerate the env types, per ADR-0005's edit-then-regenerate ritual:

```bash
bun run cf-typegen
```

### Delete what is genuinely DB-only

```bash
rm -f drizzle.config.ts
rm -rf .wrangler                                        # local D1 / R2 state
rm -f scripts/setup-local-db.sh scripts/seed-local.ts   # keep scripts/audit-direct.sh
rm -f docs/DATABASE_SETUP.md
rm -f .env.local .env.local.example
```

`worker-configuration.d.ts` is **kept** (gitignored, regenerated by
`cf-typegen`). Keep the `# cloudflare` block in `.gitignore` for the same
reason.

After deleting the env files, the only secrets path left is
`wrangler secret put` — which is where production secrets belong anyway
(ADR-0017). `docs/DEPLOYMENT.md` stays and still describes it.

## 5. Update `package.json`

```bash
bun remove better-auth drizzle-orm drizzle-kit dotenv
```

`wrangler` and `@cloudflare/vite-plugin` stay — they are the deployment, not the
database.

Remove these scripts: `db:generate`, `db:push`, `db:studio`, `db:pull`,
`db:push:local`, `db:seed:local`.

Keep everything else, explicitly including `deploy`, `preview`, and
`cf-typegen`.

After the knip run in step 8, remove any dependencies it now flags as unused.
Expected: `zod` and `@hookform/resolvers` (their last consumers were
`src/entities/user` and the profile form). `react-hook-form`, `sonner`, and
`@radix-ui/react-avatar` stay — `src/components/ui/` still uses them.

## 6. Update docs / settings

Several documents still describe the removed stack. Read each one **end to end**
and strip every reference to the database, auth, and storage layer — D1, R2,
Drizzle, Better Auth, Google OAuth, `BETTER_AUTH_*`, and the deleted `src/`
paths.

Do not expect a list of individual lines here. Earlier revisions of this skill
carried one and it was wrong every time: an enumeration goes stale as soon as
those documents change, and step 7's greps only catch references that contain a
matching literal — `README.md`'s "Start dev server (with CF bindings via
workerd)" row, for instance, describes a capability this procedure removes
without naming any of the terms. Reading is the check; the greps are a backstop.

Surfaces to go through: `README.md`, `docs/DEPLOYMENT.md`, `docs/FORKING.md`,
`.claude/settings.json`, and `aegis-share/source/documents/` (amend in place — see below).

**Do not strip these while you are in there.** They are the deployment, which
this procedure keeps:

- README's `Hosting: Cloudflare Workers` line, its `deploy` / `preview` /
  `cf-typegen` script rows, and the `ssr.tsx` entry in the project structure.
- `docs/DEPLOYMENT.md` itself and every link to it.
- In `.claude/settings.json`, the `wrangler types` / `wrangler deploy` /
  `wrangler tail` / `wrangler secret:*` entries. Remove only `wrangler d1 *`,
  `wrangler r2:*`, `drizzle-kit *`, and `bun run db:*`.
- `AGENTS.md` needs no change at all — the fork still runs on Cloudflare
  Workers.

**Places where the right edit is not a deletion:**

- `docs/DEPLOYMENT.md`'s **シークレットのローテーション** section loses its
  subject, not just some lines: `BETTER_AUTH_SECRET` and `GOOGLE_CLIENT_SECRET`
  are the only application secrets this template has, so once they go the table,
  its heading, both example `wrangler secret put` lines, and the two paragraphs
  explaining better-auth's wiring and its fail-loud guard all go with them.
  Reduce the section to generic guidance — `wrangler secret list|put|delete`
  with no named secrets, plus the ordering rule (register the new value, verify,
  then revoke the old one). That rule's procedure still holds, but its wording
  does not: it warns that reversing the order drops **認証** during the gap, and
  there is no auth left. Generalize the consequence to whatever consumes the
  secret. Step 7's grep is ASCII-only and will not flag that word. Finally, the
  section's closing paragraph, which points local secrets at the deleted env
  file, becomes "secrets go to `wrangler secret put`" (ADR-0017).
- `docs/DEPLOYMENT.md`'s rollback commands and their explanation survive. What
  goes is the **重要な限界** block after them (the D1-schema caveat and its
  three-step staged-migration list) — it only matters when a database exists.
- `docs/FORKING.md` section 2 is entirely about swapping D1 / R2 resources, so
  it empties out — but it also holds the only pointer to `docs/DEPLOYMENT.md`.
  Move that pointer into section 1 and drop the section. Its headings are
  numbered, so renumber the survivors (3→2, 4→3) rather than leaving a gap.
  Section 4 (now 3) also ends by telling the reader to consult `/remove-db` for
  removing auth — circular advice for a fork that just ran it. Drop that
  sentence and the profile-feature deletion list with it.
- ADRs: inside this repository, never delete one — a retired decision is
  superseded, not removed (the `write-adr` skill). A fork is the documented
  exception, because it is a different repository: `docs/FORKING.md` section 3
  lets it drop the ADRs that only record this template's own process history, and
  requires dropping the matching `source/edges/` entries and re-running the share
  pipeline when it does. Either way the two below are **amended in place, never
  dropped** — they describe mechanisms this removal changes, so a fork that keeps
  them needs the note and a fork that discards them needs neither.
  **ADR-0017**'s standing exception exists solely for
  drizzle-kit's `CLOUDFLARE_API_TOKEN`, so removing drizzle-kit closes it — its
  own acceptance test ("the remote path works with the token slot empty") is now
  satisfied trivially. **ADR-0007**'s amendment describes bindings being read
  through `getCloudflareEnv()` in `src/server/cloudflare.ts`, a file step 1
  deletes; note that this sub-mechanism no longer applies while the migration
  decision itself stands. ADR-0005 (`wrangler types`) and the rest of ADR-0007
  keep governing, since `cf-typegen` and the Worker deployment survive.
- If Aegis is initialized in your fork and you amended any ADR, sync
  `aegis-share/source/` and run the share pipeline.

## 7. Residual reference check

Scope the grep to database, auth, and storage terms. Do **not** grep for
`wrangler` / `cloudflare` / `CloudflareEnv` — those legitimately remain in
`wrangler.toml`, `vite.config.ts`, `src/ssr.tsx`, and `package.json`, and
treating them as leftovers is what leads to deleting the deployment by mistake.

```bash
grep -rn "better-auth\|BETTER_AUTH\|drizzle\|D1Database\|R2Bucket\|AVATARS_BUCKET\|d1_databases\|r2_buckets" \
  src scripts package.json vite.config.ts vitest.config.mts knip.json wrangler.toml \
  README.md AGENTS.md .claude/settings.json docs/DEPLOYMENT.md docs/FORKING.md
```

Read every hit and decide — a hit is not automatically a leftover. An empty
result is not evidence the removal is complete either: this finds the eight
literals above in the paths above, and anything phrased differently or living
elsewhere is invisible to it. Two exclusions from the path list are deliberate:
the ADR records keep their D1 / drizzle references as decision history
(including ADR-0017's amended exception), and generic infra checklists (e.g.
`.claude/skills/launch-checklist`) keep their generic D1 / R2 mentions.

Dead markdown links to the deleted database doc need no grep — `python3
scripts/check-md-links.py` fails on any link whose target is gone, and the Stop
gate runs it over the whole repository. What it cannot see is prose that names
the file without linking it, so check that separately:

```bash
grep -rn "DATABASE_SETUP" README.md AGENTS.md .claude/ docs/DEPLOYMENT.md docs/FORKING.md
```

Hits inside this skill file are its own instructions, not leftovers. The path
discipline is the same as above and for the same reason: the Aegis knowledge base
cites that file as history and must not be "fixed".

## 8. Verify

```bash
bun install
bun run generate-routes
bun run cf-typegen
bun run typecheck
bun run lint
bun run test
bun run knip
bun run build
bun run dev      # http://localhost:5173
bun run preview  # http://localhost:4173 — runs the built Worker
```

- `typecheck` errors point at imports of deleted modules — remove them.
- `knip` findings point at now-unused dependencies/exports — remove them (see step 5).
- `preview` passing is the signal that the Worker build is still intact. If it
  fails, something in step 1 or 4 removed part of the deployment rather than the
  database.

Deploying (`bun run deploy`) should work unchanged against the same Worker name.

## 9. Commit

Split per the Commits discipline in `AGENTS.md` (one purpose per commit; message
bodies in Japanese per that rule):

1. `feat:` — remove the auth / profile / DB-access features (`src/` deletions +
   `Header` / `__root` edits)
2. `chore:` — remove the D1 / R2 / Drizzle configuration (wrangler.toml bindings,
   drizzle.config.ts, vitest alias, knip, the local-DB scripts, the env files,
   and `docs/DATABASE_SETUP.md`)
3. `chore:` — remove the DB / auth dependencies (package.json / bun.lock)
4. `docs:` — remove DB- and auth-related documentation. Stage every surface
   step 6 touched: `README.md`, `docs/DEPLOYMENT.md`, `docs/FORKING.md`,
   `.claude/settings.json`, and the amended `adr-0007` / `adr-0017` documents
   (plus the regenerated bundle under `aegis-share/`, if your
   fork runs Aegis). AGENTS.md's Commits discipline forbids `git add -A`, so a
   surface missing from this list is a surface left uncommitted.

Intermediate commits are not individually buildable (e.g. commit 1 deletes the
vitest stub that commit 2's config change stops referencing) — verify on the
final state.
