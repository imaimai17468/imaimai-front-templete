## Review report

Stage A raised 4 candidates; Stage B merged 3 of them into one finding anchored at `ProfileForm.tsx:67`; Stage C refuted none.

```json
{
  "effort": "standard",
  "findings": [
    {
      "file": "src/components/features/profile-page/profile-form/ProfileForm.tsx",
      "line": 67,
      "title": "Inlined client ceiling is 2MB while the real limit — and the message shown — is 5MB",
      "description": "The inlined check rejects any file over 2 * 1024 * 1024 bytes, but MAX_AVATAR_BYTES is 5 * 1024 * 1024 (avatar-validation.ts:101) and the server validator enforces that 5MB ceiling via avatarSizeRejection (profile.ts:36-43). Failure scenario: a user picks a valid 3MB JPEG. The browser refuses it and shows `Please keep file size under 5MB` (the template interpolates MAX_AVATAR_BYTES, so it prints 5), and the helper text right above still reads `max 5MB` (line 143). The upload the server would have accepted is blocked, and the explanation contradicts itself. Three sub-issues fold in here: (a) the duplicated literal directly breaks the contract documented at avatar-validation.ts:96-101 (\"Exported so the client-side pre-check and the server-side validator read the same number — a duplicated literal is how the two limits drift apart\") and it has already drifted in the same commit that introduced it; (b) the empty-file check at line 63 re-implements the `size <= 0` branch of avatarSizeRejection, so the covered-by-tests owner (avatar-validation.test.ts:74-93) no longer governs client behavior; (c) the removed switch was exhaustive over the AvatarSizeRejection union, so adding a third reason used to fail compilation at this call site — the `if` chain now silently ignores it, which is the opposite of the extensibility the union was built for.",
      "severity": "critical",
      "verdict": "CONFIRMED",
      "verification": "Re-read src/components/features/profile-page/profile-form/ProfileForm.tsx:63-72 (inlined checks) and :69,:143 (both messages interpolate MAX_AVATAR_BYTES); src/lib/storage/avatar-validation.ts:96-127 (MAX_AVATAR_BYTES = 5MB, avatarSizeRejection, and the anti-duplication doc comment); src/server/fn/profile.ts:33-46 (server enforces avatarSizeRejection, message 'Avatar must be 5MB or smaller'); src/lib/storage/avatar-validation.test.ts:74-93 (boundary coverage lives on the shared function only). Attempted refutation — that 2MB might be a deliberate stricter client pre-check — fails on its own terms: the briefing states accepted sizes were meant to be unchanged, and even a deliberate tightening would still print a 5MB limit to the user and contradict line 143.",
      "fix": "Revert this block to the shared owner in src/components/features/profile-page/profile-form/ProfileForm.tsx: restore the `avatarSizeRejection` import alongside MAX_AVATAR_BYTES and restore the `switch (avatarSizeRejection(file.size))` with its `empty` / `too-large` / `null` cases and their existing messages — i.e. discard the diff for this file (`git checkout -- src/components/features/profile-page/profile-form/ProfileForm.tsx`). The switch shape, not an `if` chain, is what keeps the client honest: it is exhaustive over the union, so a future rejection reason (per-plan ceiling, minimum dimensions) fails the type check here instead of being silently accepted, and it keeps one owner for both the number and the branch semantics — which is exactly what avatar-validation.ts:96-101 and profile.ts:43 say the design is for. If a genuinely stricter browser-side ceiling is wanted, that is a product decision, not a cleanup: it needs a second exported constant (e.g. `CLIENT_AVATAR_SOFT_LIMIT_BYTES`) in avatar-validation.ts with the message interpolating that constant — do not encode it as a bare literal here.",
      "acceptance": "`grep -n '1024' src/components/features/profile-page/profile-form/ProfileForm.tsx` returns only the two MAX_AVATAR_BYTES message/label lines and no bare `2 * 1024 * 1024`; the file imports `avatarSizeRejection`; and `bun run typecheck && bun run lint && bun test src/lib/storage/avatar-validation.test.ts` pass."
    }
  ],
  "stats": { "candidates": 4, "refuted": 0 }
}
```

Nothing else in the diff drew a finding — no React-rule, design-rule, state, or cleanup issue survives in the untouched parts of the file.
