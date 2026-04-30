# 0007. Migrate from Next.js (App Router + OpenNext) to TanStack Start

- Status: accepted
- Date: 2026-04-30

## Context

This template ran on Next.js 16 (App Router) deployed to Cloudflare Workers via `@opennextjs/cloudflare`. That stack worked, but accumulated friction:

- **Type signal is indirect.** App Router is convention-first. Page params, search params, and layout-to-page data flow are inferred from filesystem structure rather than from a typed router. Errors surface at runtime or as opaque type widening.
- **OpenNext is an adapter, not a deployment target.** Cloudflare Workers compatibility was achieved by translating the Next runtime into a Workers worker. Each Next minor release risks an OpenNext lag (we hit this in 16.x). The Worker entrypoint, asset pipeline, and Node-compat shims are not under our direct control.
- **Two server-execution models in one codebase.** App Router exposes Server Components, Server Actions (`"use server"`), Route Handlers, Middleware, and `revalidatePath` — overlapping concerns with subtle caching semantics. The template's audience (derivative projects) must learn all of them to ship a small feature.
- **Vite-native tooling is already preferred elsewhere.** Vitest + `@vitejs/plugin-react` + `vite-tsconfig-paths` are already the test stack. The dev/build pipeline is the only place still on a non-Vite bundler.

TanStack Start (Vite + Nitro + TanStack Router) addresses these:

- TanStack Router gives **end-to-end type inference** from route definitions through `Link`, `useParams`, `useSearch`, and `loader` data — no `routeTree.gen.ts` divergence because the plugin regenerates it on save.
- Nitro's `cloudflare-module` preset is **a first-class deployment target**, not a translation layer. The Worker entry is generated directly from the app graph; D1/R2/KV bindings reach handlers via `event.context.cloudflare.env`.
- The server-execution model collapses to two primitives: **Server Functions** (`createServerFn`) for RPC-style mutations and **API Routes** (`createServerFileRoute`) for HTTP endpoints. No `revalidatePath`, no `"use server"` directive layering.
- The build/dev pipeline becomes pure Vite, sharing config and plugin surface with Vitest.

## Decision

Migrate the template to TanStack Start with the **`cloudflare-module` Nitro preset**. OpenNext (`@opennextjs/cloudflare`) and `next` are removed entirely. The migration is a **big bang** replacement on `main`, not an incremental coexistence — Next App Router and TanStack Router cannot share filesystem routing in a single Vite/Nitro pipeline, and the template has only one consumer surface.

Key replacements:

| Concern | Before (Next) | After (TanStack Start) |
| --- | --- | --- |
| Routing | `src/app/**/page.tsx`, `layout.tsx`, `not-found.tsx` | `src/routes/**` via `createFileRoute` + `__root.tsx` |
| Auth guard | `src/middleware.ts` matcher | route `beforeLoad` throwing `redirect()` |
| HTTP endpoints | `app/api/**/route.ts` (`NextRequest`/`NextResponse`) | `createServerFileRoute(...).methods(...)` |
| Server mutations | `"use server"` actions + `revalidatePath` | `createServerFn` + `queryClient.invalidateQueries` |
| Cloudflare env | `getCloudflareContext()` (OpenNext) | `getCloudflareEnv()` wrapping Nitro `getEvent().context.cloudflare.env` |
| Build / deploy | `opennextjs-cloudflare build && wrangler deploy` | `vite build && wrangler deploy` (Nitro emits `.output/server/index.mjs`) |
| Image optimization | `next/image` + `next.config.mjs` `remotePatterns` | plain `<img>` (R2-served avatars need no transform) |

`wrangler types` (ADR-0005) and the generated `worker-configuration.d.ts` are preserved unchanged — `CloudflareEnv` remains the single source of truth for D1/R2 bindings, and the `cf-typegen` script keeps its current contract.

`better-auth`, `drizzle-orm`, Tailwind v4 (PostCSS), `react-hook-form`, `zod`, `next-themes`, `sonner`, oxlint/oxfmt, tsgo, vitest, knip, and lefthook are all retained at their current pinned versions.

## Alternatives considered

- **Stay on Next.js.** Rejected — the friction above is structural, not transient. Next 17 will not undo the App Router execution model or remove the OpenNext dependency for Workers.
- **React Router v7 (Remix lineage).** Rejected — closer to Next's loader/action model than TanStack's typed-router model, and lacks first-party Cloudflare Workers SSR ergonomics on parity with Nitro's preset matrix.
- **Astro with React islands.** Rejected — the template targets fully interactive product UIs (login, profile editing, file upload). Astro's MPA-first model is a poor fit.
- **Incremental coexistence (Next pages alongside TanStack routes).** Rejected — file-system routing collisions, two SSR runtimes, doubled deploy surface. Big-bang on a template repo is cheaper than carrying a transitional state into derivative projects.
- **Drop Cloudflare Workers, move to Node hosting (Vercel / Render).** Rejected — D1 + R2 binding access is a deliberate template feature; losing it would force every derivative project to re-pick a database and storage layer.

## Consequences

- **Derivative projects gain typed routing for free.** New routes, params, and search params are type-checked from declaration through usage. This is the largest day-to-day DX win.
- **One server-execution model.** `createServerFn` for mutations, `createServerFileRoute` for HTTP. `"use server"`, `revalidatePath`, `next/headers`, `next/cache`, `next/navigation` are gone.
- **Cache invalidation is now an explicit client concern.** Server Functions don't auto-invalidate; mutations must call `queryClient.invalidateQueries` (or the equivalent). This trades implicit revalidation for predictable, debuggable cache flow.
- **Worker entrypoint owned by Nitro.** `wrangler.toml#main` points to `.output/server/index.mjs`, `[assets].directory` to `.output/public`. Upgrading wrangler or the Cloudflare runtime no longer requires waiting on an OpenNext release.
- **Migration cost is one-time but non-trivial.** Every page, API route, server action, and middleware is rewritten. The `Link` import path changes in 7 files. `next/image` callers (currently only `next.config.mjs#remotePatterns` for `lh3.googleusercontent.com`) are dropped — derivative projects that need image transforms must add `@unpic/react` or similar explicitly.
- **`bun audit` direct-dep policy (ADR-0002) still holds.** Adding `@tanstack/react-start` and `vite` as direct deps means their advisories are now in scope; transitive vulnerabilities under them are tolerated under the existing rule.
- **Subagent-driven implementation policy (ADR-0003) and the rules-include layout (ADR-0001) are unaffected.** The migration itself is dispatched task-by-task per `.claude/rules/agents.md`.
