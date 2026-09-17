---
description: Reads and writes end to end — gateway module shape, the server-only marker, query options and keys, loaders, mutations, and what decodes a row
globs: src/**/*.ts,src/**/*.tsx
alwaysApply: false
paths: src/**/*.ts, src/**/*.tsx
---

# Data Fetching

AGENTS.md settles the layer order and that `src/gateways/` is the authorization boundary. This file settles the shape inside it and how a component reaches it.

## What the browser receives

A `*.fn.ts` holds `createServerFn` declarations, their validators, and the `queryOptions` factories that address them. Nothing else. The compiler ships that file to the browser with each handler argument rewritten into a `fetch`, so a service, a `ManagedRuntime`, or a D1 or R2 call written there lands in the client bundle. Put it in another module and let the `*.fn.ts` import it, because that import line is what the compiler deletes once the handler argument is gone.

Every other module under `src/gateways/` opens with `import "@tanstack/react-start/server-only"`. `arch-rules/server-only-marker` reports a module that does not, and the marker fails the build when a client module reaches a marked one. `createServerOnlyFn` around a handler argument does not do this: it replaces one function and leaves a class whose static initializer still references a server import, so the module graph survives. The `src/lib` adapters that reach a binding or the request carry the marker for the same reason.

## Gateway shape

- **A directory is split by operation, not by layer.** `read.ts` and `update.ts` each hold their own authorization boundary, the services they read or write through, and the queries those services run. A chain through a module both sides share reads as depth without adding a decision, which is what `react.md`'s *No pass-through layers* refuses.
- **The directory's `index.ts` holds only what both operations use**, such as its persistence error and the helpers that log a cause and branch on it. A table added later brings its own directory and its own error.
- **A sub-directory carries an operation whose steps outgrow its file**, as `user/avatar/` does for an upload that writes a bucket, writes a row, and rolls the object back when the row write misses.

## The test seam

- **A service declaration and the real implementation live in the same file.** The service is the substitution point, so a test provides a different `Layer` and needs no binding.
- **Name a service for the column or the object it reaches**: `UserNames`, `UserAvatarKeys`, `AvatarBucket`.

## Rows

A `Schema` decodes a row, rather than a hand-written mapping. Decoding is what turns a driver's `Date` into `DateTime.Utc` and its nullable columns into `Option`. `src/entities/` owns the schema a value crosses the wire as; the row schema stays beside the query that produced it.

## Query options

- One `queryOptions` factory per read, in the `*.fn.ts` beside the server function it calls. Name it `<subject>QueryOptions`. `query/prefer-query-options` reports a `queryKey` and `queryFn` written inline at a call site.
- The key is the gateway directory and the operation as kebab-case segments, one segment per level, with the request object last where the read takes one: `["user", "current"]`. Partial-key `invalidateQueries` is the point of the hierarchy, and a spelling nobody can predict makes it a silent no-op.
- `queryFn` takes the context's `signal` and passes it to the server function (`getCurrentUserFn({ signal })`), so a cancelled query cancels the request rather than leaving it running.
- Where the row is nullable, `select` converts it (`select: Option.fromNullOr`), so every reader gets the `Option` this codebase passes around and no call site repeats the conversion. `select` runs per read and leaves `state.data` as the server sent it, so the dehydrated cache is unaffected.
- The factory is the whole export. No `useCurrentUser` wrapper hook, because the call site picks between `useSuspenseQuery`, `useQuery` and a loader, and a wrapper picks for it.

## Reading

- A route loader calls `context.queryClient.query(options)`. `ensureQueryData` and `fetchQuery` are deprecated in `@tanstack/react-query` 5.102 and their type-aware lint error fails `bun run check`.
- The component reads the same factory with `useSuspenseQuery`, so the loader has already filled the cache and the component does not suspend on its own.
- `useQuery` does not run on the server. It fetches after hydration, so data that has to be in the SSR HTML goes through the loader and `useSuspenseQuery`.
- Two independent reads in one component are one `useSuspenseQueries`. Two `useSuspenseQuery` calls side by side suspend on the first, so the second fetch starts only after the first resolves.
- Where a component reads rows only to hand them to a child, the child calls the factory itself. The cache dedupes by key, so the request still goes out once and the child stops depending on which parent rendered it. Three or more query hooks in one component is where this shows; `useSuspenseQueries` covers the reads that component renders itself.
- A read that should fail without taking the page down is `useQuery` + `isError` with an inline message. `useSuspenseQuery` throws to the nearest Error Boundary, which has to be an ancestor of the component calling the hook: a boundary that component renders as its own child never catches it, and the throw walks up to the layout and takes the whole page. Wrap the call site, or move the hook into a child inside the boundary.
- A conditional read is `useQuery({ ...options(req), enabled })`. `useSuspenseQuery` has no `enabled`.

## Writing

- A write is `useMutation({ mutationFn })` at the call site, and the `mutationFn` is the exported function that performs it.
- Invalidate in `onSuccess` by passing the same factory: `queryClient.invalidateQueries(currentUserQueryOptions())`. A write that leaves a row changed on any arm invalidates on every arm.
- Where a refetch would be wasteful for a one-field change, `cancelQueries` first and then `setQueryData`. Skipping the cancel lets an in-flight fetch land after the write and overwrite it.

## The client and the guard

- The `QueryClient` is built inside `getRouter()` in `src/router.tsx`. Start builds a router per SSR request and the Worker keeps the module between them, so a client at module scope serves one reader's rows in the next reader's HTML.
- A signed-in area is a pathless layout route (`src/routes/_authed.tsx`) whose `beforeLoad` reads the query and fails with `redirect`. That read is served from the cache while it is fresh, so on a client navigation the guard can act on a value up to `staleTime` old; `src/gateways/` authorizes every read and write, and this guard decides which page to show rather than what the caller may reach. It returns nothing into the route context: a context value is captured when `beforeLoad` runs and does not follow an invalidation, so a page reading the user from context shows the value it had before the last write.

## Checklist

- [ ] `queryOptions` factory in the `*.fn.ts`, named `<subject>QueryOptions`
- [ ] Key segments are kebab-case, one per directory level
- [ ] Loader uses `queryClient.query`, component uses `useSuspenseQuery`
- [ ] Write is `useMutation`, and `onSuccess` invalidates by passing the factory
- [ ] Every gateway module that is not a `*.fn.ts` opens with the server-only marker
- [ ] A row is decoded by a `Schema`, not by hand
