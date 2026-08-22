---
name: remove-db
description: Use when forking this template for a project that does not need a database, auth, or file storage — removes Cloudflare D1 / R2 / Better Auth / Drizzle ORM. The Cloudflare Workers deployment stays intact.
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
points at. It calls `createStartHandler` and touches no binding, so
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
step 1 deleted. Remove the `alias` block and the now-unused `node:path` import.

Keep the `coverage` block. It is the per-file 100% branch gate that AGENTS.md's
Testing section names this file as the home of, and dropping it retires that gate
silently. What changes inside it is the `include` list: prune the entries whose
paths step 1 deleted, and leave the rest.

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
    coverage: {
      include: [
        "src/lib/utils.ts",
        "tools/oxlint-plugins/arch-rules.js",
        "tools/oxlint-plugins/style-rules.js",
      ],
      thresholds: {
        perFile: true,
        branches: 100,
      },
    },
  },
});
```

### `tools/oxlint-plugins/arch-rules.js` — prune the dead layer bans

`LAYER_BANS` encodes the layer contract (routes → server/fn → gateways →
entities) as import bans. Step 1 deletes every layer below `routes`, so a ban
whose `layer` or `target` names a deleted path has nothing left to protect.
Remove those entries together with the cases in `arch-rules.test.ts` that cover
them: `vitest.config.mts` holds this file at 100% branch coverage, so a pruned
ban with a surviving test — or the reverse — fails `bun run test`. If every ban
goes, the `layer-boundaries` rule and its entry in the `plugin` export go too.
When that happens, also remove `"arch-rules/layer-boundaries": "error"` from
`.oxlintrc.json`'s `rules` map — the plugin export and that entry name the same
rule ID, so dropping only one half leaves the config pointing at a rule nothing
supplies.

**Neither file under `tools/oxlint-plugins/` is deleted.** `arch-rules.js` also
carries the component and test-shape rules, `style-rules.js` is untouched by this
procedure, and `.oxlintrc.json` loads both by path under `jsPlugins` — removing
either file breaks the lint config for the whole fork.

### `knip.json`

- Remove `"src/server/fn/**/*.ts"` from `entry`.
- Remove `"src/server/cloudflare.ts"` from `ignore`.

## 4. Config files

### `wrangler.toml` — edit, do not delete

Delete the `[[d1_databases]]` and `[[r2_buckets]]` blocks and the
`BETTER_AUTH_URL` entry under `[vars]` (drop `[vars]` entirely if it becomes
empty). Keep `name`, `main`, `compatibility_date`, and `compatibility_flags`.

Delete the `[secrets]` block and the comment above it. Every name in its
`required` list is an auth secret this procedure removes, and naming a secret
there makes it required at deploy time — `docs/DEPLOYMENT.md` carries that
contract. Leaving the block behind is the one edit in this step that breaks the
deployment this skill exists to keep: `wrangler deploy` would fail on secrets the
fork has no way to supply. When a fork introduces a secret of its own, the block
comes back carrying that name.

Leave `compatibility_flags = ["nodejs_compat"]` in place unless you have
verified nothing in the remaining build needs it — it is cheap to keep and
removing it on a hunch is how a deploy breaks in production rather than locally.

Then regenerate the env types — `wrangler.toml` changed, so `cf-typegen` follows:

```bash
bun run cf-typegen
```

### Delete what is genuinely DB-only

```bash
rm -f drizzle.config.ts
rm -rf .wrangler                # local D1 / R2 state
rm -f docs/DATABASE_SETUP.md
rm -f .env.local .env.local.example
```

`worker-configuration.d.ts` is **kept** (gitignored, regenerated by
`cf-typegen`). Keep the `# cloudflare` block in `.gitignore` for the same
reason.

After deleting the env files, the only secrets path left is
`wrangler secret put` — which is where production secrets belong anyway.
`docs/DEPLOYMENT.md` stays and still describes it.

## 5. Update `package.json`

```bash
bun remove better-auth drizzle-orm drizzle-kit dotenv
```

`wrangler` and `@cloudflare/vite-plugin` stay — they are the deployment, not the
database.

Remove these scripts: `db:generate`, `db:push`, `db:studio`, `db:pull`,
`db:push:local`.

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
matching literal — `README.md`'s quickstart still copies the env example file
this procedure deletes, for instance, without naming any of the terms. Reading is
the check; the greps are a backstop.

Surfaces to go through: `README.md`, `docs/DEPLOYMENT.md`, `docs/FORKING.md`,
and `.claude/settings.json`.

**Do not strip these while you are in there.** They are the deployment, which
this procedure keeps:

- README's `Hosting: Cloudflare Workers` line and the `ssr.tsx` entry in the
  project structure.
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
  file, becomes "secrets go to `wrangler secret put`".
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
- Two documented rules stop applying and their homes have to say so.
  `.env.local.example` and `docs/DATABASE_SETUP.md` describe the standing
  exception that lets drizzle-kit's `CLOUDFLARE_API_TOKEN` sit on disk; removing
  drizzle-kit closes that exception, so the wording goes with the files.

## 7. Residual reference check

Scope the grep to database, auth, and storage terms. Do **not** grep for
`wrangler` / `cloudflare` / `CloudflareEnv` — those legitimately remain in
`wrangler.toml`, `vite.config.ts`, `src/ssr.tsx`, and `package.json`, and
treating them as leftovers is what leads to deleting the deployment by mistake.

```bash
grep -rn "better-auth\|BETTER_AUTH\|drizzle\|D1Database\|R2Bucket\|AVATARS_BUCKET\|d1_databases\|r2_buckets" \
  src scripts tools package.json vite.config.ts vitest.config.mts knip.json wrangler.toml \
  README.md AGENTS.md .claude/settings.json docs/DEPLOYMENT.md docs/FORKING.md
```

Read every hit and decide — a hit is not automatically a leftover. An empty
result is not evidence the removal is complete either: this finds the eight
literals above in the paths above, and anything phrased differently or living
elsewhere is invisible to it. One exclusion from the path list is deliberate:
generic infra checklists (e.g. `.claude/skills/launch-checklist`) keep their
generic D1 / R2 mentions.

Dead markdown links to the deleted database doc need no grep — `bun
.claude/hooks/check-md-links.ts` fails on any link whose target is gone, and the Stop
gate runs it over the whole repository. What it cannot see is prose that names
the file without linking it, so check that separately:

```bash
grep -rn "DATABASE_SETUP" README.md AGENTS.md .claude/ docs/DEPLOYMENT.md docs/FORKING.md
```

Hits inside this skill file are its own instructions, not leftovers. The path
discipline is the same as above and for the same reason: a dated record that
cites the file describes what was true when it was written and must not be
"fixed".

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
   `.claude/settings.json`, `.env.local.example` and `wrangler.toml`.
   AGENTS.md's Commits discipline forbids `git add -A`, so a surface missing
   from this list is a surface left uncommitted.

Intermediate commits are not individually buildable (e.g. commit 1 deletes the
vitest stub that commit 2's config change stops referencing) — verify on the
final state.
