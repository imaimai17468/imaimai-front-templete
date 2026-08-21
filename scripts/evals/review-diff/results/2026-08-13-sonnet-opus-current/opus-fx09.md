I won't edit anything — that lint error is not a regression I introduced, it is finding #1 of the review I just produced, and the parent explicitly instructed "do not edit any file" (per `review-diff`, the reviewer returns fixes; the parent applies them).

The hook output is in fact independent confirmation of my Stage C verification: `oxlint --type-aware` reports exactly `src/routes/api/avatars.ts:2:1: arch-rules(layer-boundaries)` with the ADR-0016 message I predicted from reading `tools/oxlint-plugins/arch-rules.js` and `.oxlintrc.json:87`. `tsc --noEmit` produced no errors. Applying the fix below clears the lint failure.

```
{
  "effort": "standard",
  "findings": [
    {
      "file": "src/routes/api/avatars.ts",
      "line": 2,
      "title": "Route imports a gateway directly — banned by ADR-0016 and by an enabled lint rule",
      "description": "`import { fetchAvatar } from \"@/gateways/avatar\"` makes src/routes depend on src/gateways, skipping src/server/fn. ADR-0016 states routes 'Must not import gateways or src/lib/drizzle/** directly', and this is mechanically enforced: tools/oxlint-plugins/arch-rules.js encodes LAYER_BANS { layer: \"src/routes\", bans: [{ target: \"src/gateways\" }] }, enabled as an error in .oxlintrc.json. The lint gate now fails on this file. The briefing's claim that the change cannot alter dependency direction is refuted.",
      "severity": "critical",
      "verdict": "CONFIRMED",
      "verification": "Re-read src/routes/api/avatars.ts:2, tools/oxlint-plugins/arch-rules.js (LAYER_BANS + layerBoundaries.checkImportSource; resolveImportTarget maps `@/gateways/avatar` → `src/gateways/avatar`), .oxlintrc.json:87, aegis-share/source/documents/adr-0016.md:46-51. Additionally observed after the fact: the Stop-hook lint run emitted `src/routes/api/avatars.ts:2:1: error arch-rules(layer-boundaries)`.",
      "fix": "Delete line 2 and the block it exists for (lines 9-12) in src/routes/api/avatars.ts, restoring `const url = new URL(request.url); const result = await readAvatarForCurrentUser(url.searchParams.get(\"key\"));`. Do not add a lint-disable comment — AGENTS.md forbids suppressing an error that way, and ADR-0016 requires an ADR amendment for a genuine layer bypass. If eager fetching is genuinely wanted, it belongs inside src/server/fn/avatar.ts after the session and isOwnAvatarKey checks, where the gateway import is legal.",
      "acceptance": "`grep -n \"@/gateways\" src/routes/api/avatars.ts` returns nothing, and `bunx oxlint --type-aware src tools` exits 0."
    },
    {
      "file": "src/routes/api/avatars.ts",
      "line": 10,
      "title": "Attacker-controlled R2 read executed before any authentication or key-ownership check",
      "description": "`untrustedKey` comes straight from the query string and is passed to `fetchAvatar` at line 11 before `readAvatarForCurrentUser` (line 13) resolves the session or runs `isOwnAvatarKey`. Every authorization gate for this feature lives inside src/server/fn/avatar.ts, so this call is upstream of all of them. Failure scenario: an unauthenticated client sends GET /api/avatars?key=<other-user-id>/avatar.png; the Worker performs a real R2 GET on that key and only afterwards returns 401. The bytes never reach the caller, but an unauthenticated caller now drives arbitrary-key reads against the bucket where previously it touched no persistence at all. The hit/miss latency difference is an existence oracle over other users' keys, and the read is ungated by any session, so it is also an unauthenticated R2 cost amplification vector.",
      "severity": "critical",
      "verdict": "CONFIRMED",
      "verification": "Re-read src/routes/api/avatars.ts:8-13 (statement order), src/server/fn/avatar.ts:12-24 (getSession/unauthorized and isOwnAvatarKey/invalid-key both run only inside readAvatarForCurrentUser), src/gateways/avatar/index.ts:9-11 (`AVATARS_BUCKET.get(key)` performs no validation of its own).",
      "fix": "Remove lines 9-12 of src/routes/api/avatars.ts; the route must reach persistence only through readAvatarForCurrentUser. No reordering inside the route can restore the property, because session resolution lives one layer down. If the latency win is the real goal, implement it inside readAvatarForCurrentUser after the isOwnAvatarKey check, where the key is already ownership-validated.",
      "acceptance": "src/routes/api/avatars.ts contains no call other than `readAvatarForCurrentUser` before its `switch`, and src/routes/api/-avatars.test.ts (which mocks only @/server/fn/avatar) passes unmodified — a passing run is itself proof the route reaches no gateway."
    },
    {
      "file": "src/routes/api/avatars.ts",
      "line": 11,
      "title": "Unhandled gateway error turns 401/400 responses into a 500, and breaks the existing route tests",
      "description": "Three consequences of the awaited, unguarded call. (1) Error shape: fetchAvatar has no try/catch and its own test asserts it propagates R2 failures; line 11 is unwrapped, so an R2 error now throws before the switch — a 500 where the route previously returned 401 (no session) or 400 (invalid key). (2) Test breakage: src/routes/api/-avatars.test.ts mocks only @/server/fn/avatar and its `request()` helper always supplies `?key=user-1%2Favatar.png`, so the real fetchAvatar runs against the cloudflare:workers stub whose `env` is `{}` — `getCloudflareEnv().AVATARS_BUCKET` is undefined and `.get(key)` throws a TypeError in every case of that suite. (3) Cost/latency: the call is awaited before line 13 with no cache between them, so a legitimate request performs two identical R2 GETs in series — the change adds a round trip rather than hiding one.",
      "severity": "major",
      "verdict": "CONFIRMED",
      "verification": "Re-read src/routes/api/avatars.ts:10-13 (await, no try/catch, sequential with line 13), src/gateways/avatar/index.ts:9-19 and src/gateways/avatar/index.test.ts:59-65 ('should propagate the error when R2 fails'), src/routes/api/-avatars.test.ts:8-13 (single vi.mock; request URL always carries `key`), vitest.config.mts:8-13 (cloudflare:workers alias) and src/test/cloudflare-workers-stub.ts:1 (`export const env = {}`). NOTE: vitest was not executed — the Bash invocation was denied by permissions — so the test-breakage part is derived statically from those five files, not observed.",
      "fix": "The same single change: delete lines 9-12 of src/routes/api/avatars.ts. That restores the 401/400/404 switch as the only outcome surface and makes the route test's single mock sufficient again. Do not instead wrap line 11 in try/catch or add a @/gateways/avatar mock to the test — either preserves the unauthorized persistence access and the layer violation while teaching the test to tolerate a call the route should not make.",
      "acceptance": "`bunx vitest run src/routes/api/-avatars.test.ts` passes with that test file unmodified (no new vi.mock added to it)."
    }
  ],
  "stats": { "candidates": 7, "refuted": 2 }
}
```

Refuted, for transparency: the discarded R2 body stream possibly leaking (`src/gateways/avatar/index.ts:14-18` — Workers runtime behaviour I have no web tool to confirm, so REFUTED by the uncertainty default), and the duplicated `searchParams.get("key")` at `src/routes/api/avatars.ts:9-13` (real but behaviour-identical and erased by the fix, so cleanup-lens noise).

All three survivors are cleared by one edit — remove the import on line 2 and the block on lines 9–12 — which is the parent's to apply.
