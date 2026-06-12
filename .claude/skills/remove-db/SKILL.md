---
name: remove-db
description: Use when forking this template for a project that does not need a database, auth, or file storage — removes Cloudflare D1 / R2 / Better Auth / Drizzle ORM and the Cloudflare Workers deployment wiring.
user_invocable: true
---

# Remove DB / Auth / Storage

Strips the template down to a pure frontend (TanStack Start + Vite) by removing:

- Cloudflare D1 + Drizzle ORM (database)
- Cloudflare R2 (avatar storage)
- Better Auth (Google OAuth)
- Cloudflare Workers deployment wiring (`@cloudflare/vite-plugin`, `wrangler`)

What stays: the TanStack Start app shell, shared UI (`src/components/ui`, header, mode-toggle, theme-provider), the Clock sample, and the oxlint / oxfmt / tsgo / knip / vitest toolchain.

## Preconditions

- `git status` is clean; work on a dedicated branch (the change set is large).

## 1. Delete source code

```bash
rm -rf src/lib/auth src/lib/drizzle src/lib/storage
rm -f src/lib/auth.ts
rm -rf src/entities src/gateways src/server
rm -rf src/routes/api
rm -f src/routes/login.tsx src/routes/profile.tsx src/routes/auth.auth-code-error.tsx
rm -rf src/components/features/profile-page
rmdir src/components/features 2>/dev/null || true
rm -rf src/components/shared/header/auth-navigation src/components/shared/header/user-menu
rm -f src/test/cloudflare-workers-stub.ts
```

`src/routeTree.gen.ts` is gitignored and generated — refresh it with `bun run generate-routes` after deleting route files.

## 2. Fix auth-dependent UI

### `src/components/shared/header/Header.tsx`

Remove the `user` prop, the `UserWithEmail` / `AuthNavigation` imports, and the `similarity-ignore` comment:

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

### Residual auth references

```bash
grep -rn "signIn\|signOut\|session\|getCurrentUserFn\|AuthNavigation\|UserMenu\|UserWithEmail" src/
```

Remove every hit individually.

## 3. Update build / test config

### `vite.config.ts` — drop the Cloudflare plugin

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tanstackStart(), react(), tailwindcss()],
});
```

### `vitest.config.mts` — drop the `cloudflare:workers` alias

Remove the `alias` block and the now-unused `resolve` / `node:path` import:

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
    passWithNoTests: true,
    isolate: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

### `knip.json`

- Remove `"src/server/fn/**/*.ts"` from `entry`.
- Remove `"src/server/cloudflare.ts"` from `ignore`.

## 4. Delete config files

```bash
rm -f wrangler.toml drizzle.config.ts worker-configuration.d.ts
rm -rf .wrangler
rm -f scripts/setup-local-db.sh scripts/seed-local.ts   # keep scripts/audit-direct.sh
rm -f docs/DATABASE_SETUP.md
rm -f .env.local .env.local.example
```

Optionally remove the `# cloudflare` block (`.wrangler`, `worker-configuration.d.ts`) from `.gitignore`.

## 5. Update `package.json`

```bash
bun remove better-auth drizzle-orm drizzle-kit wrangler @cloudflare/vite-plugin @cloudflare/workers-types dotenv
```

Remove these scripts: `cf-typegen`, `db:generate`, `db:push`, `db:studio`, `db:pull`, `db:push:local`, `db:seed:local`, `deploy`.

Keep: `generate-routes`, `dev`, `build`, `preview`, `lint*`, `format*`, `check*`, `typecheck`, `test`, `knip`.

After the knip run in step 8, remove any dependencies it now flags as unused. Expected: `zod` and `@hookform/resolvers` (their last consumers were `src/entities/user` and the profile form). `react-hook-form`, `sonner`, and `@radix-ui/react-avatar` stay — `src/components/ui/` still uses them.

## 6. Update docs / settings

- **`README.md`**: remove Better Auth / Cloudflare D1 / R2 from the tech stack, the "D1 / R2 bindings work in `bun run dev`" note, the `docs/DATABASE_SETUP.md` link, the `deploy` / `cf-typegen` command-table rows, the `entities/` / `gateways/` / `server/` / `lib/auth` / `lib/drizzle` / `lib/storage` entries in the project structure, and the Better Auth / Cloudflare D1 / R2 reference links.
- **`AGENTS.md`**: in the `## Tools` section, remove the `cf-typegen` bullet and the DB (Drizzle + D1) bullet.
- **`.claude/settings.json`**: remove the `wrangler *`, `drizzle-kit *`, and `bun run db:*` permission entries.
- **`docs/adr/`**: delete `0005-wrangler-types-for-cloudflare-env.md` and its row in `docs/adr/README.md`. Skim the other ADRs for D1 / R2 / wrangler decisions that no longer apply (0007 mentions Cloudflare only as migration history — keeping it is fine).
- If Aegis is initialized in your fork, sync `aegis-share/source/` and run `share-materialize` after editing `docs/adr/`.

## 7. Residual reference check

```bash
grep -rn "better-auth\|BETTER_AUTH\|drizzle\|wrangler\|cloudflare\|CloudflareEnv\|D1Database\|R2Bucket\|AVATARS_BUCKET" \
  src scripts package.json vite.config.ts vitest.config.mts knip.json README.md AGENTS.md .claude/settings.json
```

Expect zero hits. Generic infra checklists (e.g. `.claude/skills/launch-checklist`) may keep their generic D1 / R2 mentions.

## 8. Verify

```bash
bun install
bun run generate-routes
bun run typecheck
bun run lint
bun run test
bun run knip
bun run build
bun run dev   # open http://localhost:5173
```

- `typecheck` errors point at imports of deleted modules — remove them.
- `knip` findings point at now-unused dependencies/exports — remove them (see step 5).

## 9. Commit

Split per the Commits discipline in `AGENTS.md` (one purpose per commit; message bodies in Japanese per that rule):

1. `feat:` — remove the auth / profile / DB-access features (`src/` deletions + `Header` / `__root` edits)
2. `chore:` — remove the Cloudflare / Drizzle config and scripts (wrangler.toml / drizzle.config.ts / vite / vitest / knip / scripts / `.env*`)
3. `chore:` — remove the DB / auth / storage dependencies (package.json / bun.lockb)
4. `docs:` — remove DB- and auth-related documentation (README / `AGENTS.md` / settings / ADR)

Intermediate commits are not individually buildable (e.g. commit 1 deletes the vitest stub that commit 2's config change stops referencing) — verify on the final state.
