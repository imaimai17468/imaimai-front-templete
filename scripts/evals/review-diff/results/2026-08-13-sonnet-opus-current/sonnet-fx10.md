Confirms server-side still uses `avatarSizeRejection`/`MAX_AVATAR_BYTES` (5MB), while the client now hardcodes `2 * 1024 * 1024` (2MB) but reports the message using `MAX_AVATAR_BYTES` (5MB). Now I have everything needed for Stage A/B/C/D.

## Stage A — Find

1. `ProfileForm.tsx:67` — client size check hardcodes `2 * 1024 * 1024` instead of using `MAX_AVATAR_BYTES` (5MB, from `avatar-validation.ts:101`). Client now rejects 2–5MB files that the server (`profile.ts` via `avatarSizeRejection`) would accept, and the error toast still says "under 5MB" (computed from `MAX_AVATAR_BYTES`), contradicting the actual 2MB cutoff. Lens: logic/integrity, and rule (shared-constant intent documented in the constant's own doc comment).
2. `ProfileForm.tsx:63-72` — the shared `avatarSizeRejection` classifier (still exported, still used server-side) is no longer reused client-side; duplicated size-threshold logic now lives in two places (client literal, server function), inviting future drift. Lens: cleanup/duplication.
3. `ProfileForm.tsx:21` — import of `avatarSizeRejection` removed but `MAX_AVATAR_BYTES` still imported — partial cleanup, consistent with finding 1/2, not independently new.

## Stage B — Dedup

Findings 1 and 2 both anchor to `ProfileForm.tsx:63-72` (same region) — merge into one, keeping the higher-severity framing (message/behavior mismatch is major; duplication is the underlying cause). Finding 3 folds in as supporting detail (unused-import-adjacent asymmetry, not separately actionable).

Deduped candidate list: 1 finding.

## Stage C — Refute

**Candidate: client/server size-limit mismatch + stale message, `ProfileForm.tsx:63-72`**

- Re-read `src/components/features/profile-page/profile-form/ProfileForm.tsx:59-77` (post-diff): the new inline check is `if (file.size > 2 * 1024 * 1024)`, hardcoded, while the toast text is `` `Please keep file size under ${MAX_AVATAR_BYTES / 1024 / 1024}MB` ``.
- Re-read `src/lib/storage/avatar-validation.ts:101` — `MAX_AVATAR_BYTES = 5 * 1024 * 1024` (5MB), and `:117-127` — `avatarSizeRejection` uses this same constant for `"too-large"`.
- Re-read `src/server/fn/profile.ts:36-42` — server's `uploadAvatarFn` still calls `avatarSizeRejection(file.size)` and messages `` `Avatar must be ${MAX_AVATAR_BYTES / 1024 / 1024}MB or smaller` `` (5MB), confirming server truth is 5MB.
- Correctness lens: the claim "accepted sizes... remain unchanged" is false — client-visible acceptance shrank from 5MB to 2MB while server still accepts up to 5MB.
- Reproduction lens: select a 3MB image → client toast fires "Please keep file size under 5MB" while rejecting a file under that stated limit → user-visible contradiction, and a valid (per server) 3–5MB avatar can never be submitted through the UI (network tab would show no request, since the handler returns early).
- Scope lens: `MAX_AVATAR_BYTES`'s own doc comment (`avatar-validation.ts:96-100`) explicitly states it's "exported so the client-side pre-check and the server-side validator read the same number — a duplicated literal is how the two limits drift apart." The diff does exactly the drift the constant's doc warns against. This is a direct violation of that documented invariant (not a formal AGENTS.md rule citation, but a same-file, self-documented contract broken by this diff — squarely in scope, not pre-existing, since the file changed is the violator).

Verdict: **CONFIRMED** (majority/all three lenses confirm; severity: critical — user-facing functional regression + shipped incorrect UI copy, with a documented invariant broken in the very file whose comment states it).

## Stage D — Return

```json
{
  "effort": "high",
  "findings": [
    {
      "file": "src/components/features/profile-page/profile-form/ProfileForm.tsx",
      "line": 67,
      "title": "Client avatar-size check hardcodes 2MB, diverging from server's 5MB limit and its own error message",
      "description": "The inlined check `file.size > 2 * 1024 * 1024` replaces the shared `avatarSizeRejection(file.size)` call, dropping the 5MB `MAX_AVATAR_BYTES` threshold to a hardcoded 2MB on the client only. The server (`src/server/fn/profile.ts:36`) still validates against the real 5MB limit via `avatarSizeRejection`. Result: a 2–5MB avatar the server would accept is now rejected client-side before any request is made, and the toast text (`Please keep file size under ${MAX_AVATAR_BYTES / 1024 / 1024}MB`) still reads '5MB' — directly contradicting the 2MB cutoff the code just enforced. This is the exact drift `MAX_AVATAR_BYTES`'s doc comment (`src/lib/storage/avatar-validation.ts:96-100`) warns the shared export exists to prevent.",
      "severity": "critical",
      "verdict": "CONFIRMED",
      "verification": "src/components/features/profile-page/profile-form/ProfileForm.tsx:63-72 (new inline checks); src/lib/storage/avatar-validation.ts:101 (MAX_AVATAR_BYTES=5*1024*1024) and :117-127 (avatarSizeRejection uses it); src/server/fn/profile.ts:36-42 (server still calls avatarSizeRejection and messages against MAX_AVATAR_BYTES)",
      "fix": "Revert the inlining: restore `import { avatarSizeRejection, MAX_AVATAR_BYTES } from \"@/lib/storage/avatar-validation\"` and the `switch (avatarSizeRejection(file.size)) { case \"empty\": ...; case \"too-large\": ...; case null: break; }` structure that was removed, so the client reads the same `MAX_AVATAR_BYTES`-derived threshold and reason codes the server enforces. If the intent was genuinely to lower the client-only pre-check to 2MB (e.g. to fail faster on slow connections), that is a product decision, not a refactor — it must (a) keep using `MAX_AVATAR_BYTES` or a newly named exported constant for the message text so the two never disagree, and (b) be stated as an intentional UX change, not folded into a 'simplify validation' diff. Absent such a stated decision, restore parity with the server.",
      "acceptance": "src/components/features/profile-page/profile-form/ProfileForm.tsx no longer contains a bare numeric literal for the avatar size threshold; it either calls `avatarSizeRejection` (preferred) or compares against `MAX_AVATAR_BYTES` directly, and the toast message's stated limit matches the value actually enforced. Manually or via test: selecting a 3MB file behaves identically to the pre-diff code (accepted, matching server)."
    }
  ],
  "stats": { "candidates": 3, "refuted": 0 }
}
```

(3 raw Stage-A candidates deduped to 1 survivor spanning the same lines; 0 refuted after merge — all evidence for the merged finding held up under the correctness/reproduction/scope lenses.)
