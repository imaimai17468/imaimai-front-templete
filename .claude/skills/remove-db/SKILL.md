---
name: remove-db
description: Use when forking this template for a project that does not need a database, auth, or file storage. Removes Cloudflare D1 / R2 / Better Auth / Drizzle ORM. The Cloudflare Workers deployment stays intact.
---

# Remove DB / Auth / Storage

Strips the template down to a frontend-only TanStack Start app by removing:

- Cloudflare D1 + Drizzle ORM (database)
- Cloudflare R2 (avatar storage)
- Better Auth (Google OAuth)

**The Cloudflare Workers deployment is deliberately kept.** Void binds `DB`
because a module imports `void/db` and `STORAGE` because one imports
`void/storage`, so deleting those modules removes the bindings. `void.config.ts`,
`voidPlugin()` in `vite.config.ts` and `bun run deploy` stay, and the Worker
still has something to deploy. Step 8 says what has not been verified about that
deploy.

What else stays: the app shell, shared UI (`src/shared/ui`, header,
mode-toggle, theme-provider), the sample home page, and the oxlint / oxfmt /
tsc / fallow / vitest toolchain.

## Preconditions

- `git status` is clean, and the work happens on a dedicated branch (the change set is large).

## 1. Delete source code

```bash
rm -rf src/lib/auth src/lib/storage
rm -rf src/shared/entities src/shared/gateway
rm -rf src/routes/api
rm -rf src/routes/login src/routes/_authed
rm -rf src/shared/components/header/auth-navigation src/shared/components/header/user-menu
rm -rf db
rm -f env.ts
rm -f src/test/cloudflare-workers-stub.ts
```

`src/routeTree.gen.ts` is gitignored and generated, so refresh it with
`bun run generate-routes` after deleting route files.

Three deletions above are easy to misread as deployment removals, and none is one:

- `db/` holds the Drizzle schema and the migrations `bun run dev` applies to the
  local D1. With no `void/db` import left, Void binds no D1.
- `env.ts` declares the three auth secrets and nothing else. With no
  `void/env` import left, nothing reads it.
- `src/test/cloudflare-workers-stub.ts` exists *only* to satisfy the vitest
  alias for the `cloudflare:workers` import that `void/env` makes (step 3). It
  goes with it.

## 2. Fix auth-dependent UI

### `src/shared/components/header/header.tsx`

Delete the `user` prop and its type, the `Option` / `UserWithEmail` /
`AuthNavigation` imports, and the `<AuthNavigation user={user} />` element.
Leave the rest of the markup as it is.

### `src/routes/__root.tsx`

- Delete the `currentUserQueryOptions` import and the `loader` option.
- Delete `const { data: user } = useSuspenseQuery(currentUserQueryOptions());` and render `<Header />` without props.

### `src/routes/index/-components/home-content.ts`

The sample home page hardcodes the stack. Remove the `認証`, `データ` and `ファイル` rows
from the `同梱されているもの` section of the `SPECS` array, which carry
`Better Auth`, `Drizzle ORM` and Cloudflare R2, drop D1 and R2 from the
Workers row's detail, and remove the Better Auth, Cloudflare D1 and
Cloudflare R2 entries from `LINKS`. Note: the step 7 residual grep
will **not** catch these, because `"Better Auth"` has a space and
`"Drizzle ORM"` is capitalized, so neither matches the `better-auth` /
`drizzle` (lowercase, case-sensitive) patterns. Fix them here explicitly.

### Residual auth references

```bash
grep -rn "signIn\|signOut\|session\|currentUserQueryOptions\|AuthNavigation\|UserMenu\|UserWithEmail" src/
```

Remove every hit individually.

## 3. Update build / test config

### `vite.config.ts`: drop the migrations entry, keep `voidPlugin()`

`voidPlugin()` builds and serves the Worker whatever bindings the source asks
for, so it stays. The file's one edit is removing the `db/migrations` entry from
the formatter's ignore list, because step 1 deleted that directory.

### `tsconfig.json`: drop the three Void paths

Remove the `@schema`, `@schema/*` and `void/db` entries from `paths`, because step 1 deleted
the schema they point at. Keep `extends`, which still carries Void's env types.

### `vitest.config.mts`: drop the `cloudflare:workers` alias

The alias only existed to stub that import for `void/env`, which nothing imports
after step 1. Remove the `alias` block and the now-unused `node:path` import.

Keep the `coverage` block. It is the per-file 100% branch gate that AGENTS.md's
Testing section names this file as the home of, and dropping it retires that gate
silently. Inside it, remove the `coverageExclude` entry
`"src/routes/api/auth.$.ts"` and the comment above it, because step 1 deletes that
route. Then read the remaining entries against the tree step 1 leaves and drop any
other one that names a file it deleted.

### `.fallowrc.jsonc`: drop the deleted entries

Remove `env.ts` and `db/schema.ts` from `dynamicallyLoaded`.

### `tools/oxlint-plugins/arch-rules.js`: prune the dead layer bans

`LAYER_RULES` encodes as import bans the layer order AGENTS.md's Rules section
names. Each key is a layer `layerOf` returns, and its entry bans a target by
path (`paths`), by the layer `layerOf` gives that target (`layers`), or by bare
specifier (`externals`). Step 1 deletes the gateway and entity layers and the
`src/lib/` adapters the browser bans name, so drop the `gateway` and `entity`
keys, every `layers` entry naming one of them, and every `paths` or `externals`
entry whose target step 1 removed (`void/db`, `void/storage`, `void/env`,
`@schema`). Drop the matching names from `ROLE_BY_SEGMENT` and `layerOf`.
Remove those entries together with the cases in `arch-rules.test.ts` that cover
them: `vitest.config.mts` holds this file at 100% branch coverage, so a pruned
ban with a surviving test, or the reverse, fails `bun run test`. If every ban
goes, the `layer-boundaries` rule and its entry in the `plugin` export go too.
When that happens, also remove `"arch-rules/layer-boundaries": "error"` from
`vite.config.ts`'s `lint.rules` map, because the plugin export and that entry name the same
rule ID, so dropping only one half leaves the config pointing at a rule nothing
supplies.

**No plugin under `tools/oxlint-plugins/` is deleted.** `arch-rules.js` also
carries the component and test-shape rules, `style-rules.js` and `start-rules.js`
are untouched by this procedure, and `vite.config.ts` loads each by path under
`lint.jsPlugins`, so removing any of them breaks the lint config for the whole fork.

## 4. Local files

```bash
rm -f scripts/setup/placeholders.dotenv
rm -rf .void                    # local D1 / R2 state and generated types; bun run dev recreates it
rm -f docs/DATABASE_SETUP.md
```

The root dotenv file is gitignored, and once `env.ts` is gone nothing reads it.
`.claude/hooks/pre-bash-guard/pre-bash-guard.sh` refuses any command naming it,
so leave deleting it to the user.

`scripts/setup/setup.sh` ends by copying the placeholder file onto the root
dotenv file, and `.claude/hooks/session-start-env-check/session-start-env-check.sh`
does the same copy at session start. Delete that `if` block from both scripts,
and from `scripts/setup/setup.test.ts` delete every case and step constant
naming either file. Left in place, the copy has no source, so `bun run setup`
prints `[setup] failed at: cp` and exits 1 on every run from here on.

The secrets path left is `void secret put`, which is where a fork's own
production secrets go. `docs/DEPLOYMENT.md` stays and still describes it.

## 5. Update `package.json`

```bash
bun remove better-auth drizzle-orm
```

`void` stays, because it is the deployment rather than the database.

Remove these scripts: `db:generate`, `db:migrate`, `db:studio`.

Keep everything else, explicitly including `dev`, `deploy` and `generate-void`.

After the `bun run dead-code` run in step 8, remove any dependencies it now flags as unused.
Expected: `@hookform/resolvers` (its last consumer was the profile form).
`react-hook-form`, `sonner`, and `radix-ui` stay, because
`src/shared/ui/` still uses them.

## 6. Update docs / settings

Several documents still describe the removed stack. Read each one **end to end**
and strip every reference to the database, auth, and storage layer: D1, R2,
Drizzle, Better Auth, Google OAuth, `BETTER_AUTH_*`, and the deleted `src/`
paths.

No list of individual lines follows, for the reason `prose.md`'s Instruction
documents rule gives. Step 7's greps catch only references that contain a
matching literal, and `README.md`'s quickstart names the dotenv file this
procedure deletes without naming any of the terms.

Surfaces to go through: `README.md`, `docs/DEPLOYMENT.md`, `docs/FORKING.md`,
`.claude/settings.json`, and `.cursor/permissions.json`.

**Do not strip these while you are in there.** They are the deployment, which
this procedure keeps:

- README's `ホスティング: Cloudflare Workers` line.
- `docs/DEPLOYMENT.md` itself and every link to it.
- In `.cursor/permissions.json`'s `block_instructions`, the `bun run deploy` and
  `void` entries. Remove only `db:generate`.
- In `AGENTS.md`, everything but the binding paragraph's `DB` and `STORAGE`
  sentence, which names bindings the fork no longer has.

**Places where the right edit is not a deletion:**

- `docs/DEPLOYMENT.md`'s secrets and rotation sections lose their subject, not
  just some lines: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are the only application secrets this template has, so
  once they go, the example lines, the table, and the paragraphs explaining
  better-auth's wiring and its fail-loud guard all go with them. Reduce the two
  sections to generic guidance: a secret is declared in `env.ts` and set with
  `void secret put`, plus the ordering rule (deploy the new value, verify, then
  revoke the old one). That rule's procedure still holds, but its wording does
  not: it warns that reversing the order drops **認証** during the gap, and
  there is no auth left. Generalize the consequence to whatever consumes the
  secret. Step 7's grep is ASCII-only and will not flag that word.
- `docs/DEPLOYMENT.md`'s rollback section survives. What goes is the D1-schema
  caveat in it and the migration paragraph under デプロイ, which only matter
  when a database exists.
- `docs/FORKING.md` section 2 is entirely about swapping D1 / R2 resources, so
  it empties out, and it also holds the only pointer to `docs/DEPLOYMENT.md`.
  Move that pointer into section 1 and drop the section. Its headings are
  numbered, so renumber the survivors (3→2, 4→3) rather than leaving a gap.
  Section 4 (now 3) also ends by telling the reader to consult `/remove-db` for
  removing auth, which is circular advice for a fork that just ran it. Drop that
  sentence and the profile-feature deletion list with it.

## 7. Residual reference check

Scope the grep to database, auth, and storage terms. Do **not** grep for
`void` / `cloudflare`, because those legitimately remain in `void.config.ts`,
`vite.config.ts`, and `package.json`, and treating them as leftovers is what
leads to deleting the deployment by mistake.

```bash
grep -rn "better-auth\|BETTER_AUTH\|drizzle\|D1Database\|R2Bucket\|void/db\|void/storage\|@schema" \
  src scripts tools package.json vite.config.ts vitest.config.mts tsconfig.json .fallowrc.jsonc void.config.ts \
  README.md AGENTS.md .claude/settings.json docs/DEPLOYMENT.md docs/FORKING.md
```

Read every hit and decide, because a hit is not automatically a leftover. This
grep reaches the eight literals above in the paths above and nothing else, so an
empty result carries no proof, which `prose.md`'s Instruction documents rule
states for a grep in general. One exclusion from the path list is deliberate:
generic infra checklists (e.g. `.claude/skills/launch-checklist`) keep their
generic D1 / R2 mentions.

Check for links to the deleted database doc, and for prose that names the file
without linking it:

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
bun run generate-void
bun run check
bun run test
bun run dead-code
bun run build
bun run dev      # http://my-app.localhost:1355 (portless)
```

- `typecheck` errors point at imports of deleted modules. Remove them.
- `dead-code` findings point at now-unused dependencies/exports. Remove them (see step 5).
- `bun run dev` serving the home page is the signal that the Worker still runs
  under Void. If it fails, something in step 1 or 4 removed part of the
  deployment rather than the database. `bun run build` exiting 0 is the signal
  that the bundle `bun run deploy` uploads still builds.

Not verified: an app deployed before this procedure still has the D1 database
and R2 bucket its earlier `bun run deploy` created. What `void deploy` does
with a resource that no import infers any more was not found in Void's bundled
docs, so before anyone deploys, the user checks the account for them, removes
them with Cloudflare's own tools if they are no longer wanted, and reads what
`void.lock.json` still records.

## 9. Commit

Split per the Commits discipline in `AGENTS.md`:

1. `feat:` remove the auth / profile / DB-access features (`src/` deletions +
   `Header` / `__root` edits)
2. `chore:` remove the D1 / R2 / Drizzle configuration (`db/`, `env.ts`, the
   `tsconfig.json` paths, the vitest alias, the local-DB scripts, the
   placeholder file, `scripts/setup/setup.sh`, `scripts/setup/setup.test.ts`,
   the session-start hook, and `docs/DATABASE_SETUP.md`)
3. `chore:` remove the DB / auth dependencies (package.json / bun.lock)
4. `docs:` remove DB- and auth-related documentation. Stage every surface
   step 6 touched, each by its explicit path as that discipline requires:
   `README.md`, `docs/DEPLOYMENT.md`, `docs/FORKING.md`, `AGENTS.md`,
   `.claude/settings.json`, and `.cursor/permissions.json`. A surface
   missing from this list is a surface left uncommitted.

Intermediate commits are not individually buildable (e.g. commit 1 deletes the
vitest stub that commit 2's config change stops referencing), so verify on the
final state.
