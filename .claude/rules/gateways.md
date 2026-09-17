---
description: How a gateway directory is shaped, which of its modules the compiler ships to the browser, where the test seam sits, and what decodes a database row
globs: src/gateways/**/*.ts
alwaysApply: false
paths: src/gateways/**/*.ts
---

# Gateways

AGENTS.md settles the layer this sits in and that it is the authorization boundary. This file settles the shape inside it. `react.md`'s Module Organization holds the placement rules this directory obeys like any other, so the ones below are the ones a gateway adds.

## What the browser receives

**A `*.fn.ts` holds `createServerFn` declarations and their validators, and nothing else.** The compiler ships that file to the browser with each handler argument rewritten into a `fetch`, so a service, a `ManagedRuntime`, or a D1 or R2 call written there lands in the client bundle. Put it in another module and let the `*.fn.ts` import it, because that import line is what the compiler deletes once the handler argument is gone.

**Every other module opens with `import "@tanstack/react-start/server-only"`.** `arch-rules/server-only-marker` reports a module that does not, and the marker fails the build when a client module reaches a marked one. `createServerOnlyFn` around a handler argument does not do this: it replaces one function and leaves a class whose static initializer still references a server import, so the module graph survives. The `src/lib` adapters that reach a binding or the request carry the marker for the same reason.

## Shape

**A directory is split by operation, not by layer.** `read.ts` and `update.ts` each hold their own authorization boundary, the services they read or write through, and the queries those services run. One operation is one file, rather than a chain through a module both sides share. A chain of that kind reads as depth without adding a decision, which is what `react.md`'s *No pass-through layers* refuses.

**The directory's `index.ts` holds only what both operations use**, such as its persistence error and the helpers that log a cause and branch on it. A table added later brings its own directory and its own error, so nothing here is written to be shared across domains.

**A sub-directory carries an operation whose steps outgrow its file**, as `user/avatar/` does for an upload that writes a bucket, writes a row, and rolls the object back when the row write misses.

## The test seam

**A service declaration and the real implementation live in the same file.** The service is the substitution point, so a test provides a different `Layer` and needs no binding. A separate module holding the real dependency buys nothing the layer does not already buy, and it puts one operation in two files.

**Name a service for the column or the object it reaches**, so what a test has to provide is readable from the name: `UserNames`, `UserAvatarKeys`, `AvatarBucket`.

## Rows

**A `Schema` decodes a row, rather than a hand-written mapping.** Decoding is what turns a driver's `Date` into `DateTime.Utc` and its nullable columns into `Option`, so neither conversion is written twice and neither drifts from the entity the row becomes. `src/entities/` owns the schema a value crosses the wire as; the row schema stays beside the query that produced it.
