# fx-08 (large mixed diff — realistic-scale probe)
base: 8b53489 (any tree where seed.patch applies cleanly)

Eight files: six benign edits + two seeded defects. Measures (a) detection
inside a noisy multi-file diff, (b) FP resistance on the benign majority,
and (c) — via `delta.patch` — delta-mode savings at realistic diff size.

## Expected findings
- file: src/gateways/user/index.ts
  nature: updateUser's catch now returns { success: true } — a DB write
  failure is swallowed and reported as success (integrity).
  severity-floor: major
- file: src/components/features/profile-page/profile-form/ProfileForm.tsx
  nature: avatar size check inverted (`>` → `<`) — files UNDER 5MB are now
  rejected with the "keep under 5MB" message while oversized files pass
  (logic/inverted condition).
  severity-floor: major

## Must NOT be flagged (each counts as an FP if a CONFIRMED finding survives)
- src/lib/utils.ts, src/lib/auth.ts, src/test-setup.ts,
  src/server/cloudflare.ts (comment/JSDoc additions)
- src/routes/login.tsx (label extracted to a constant, behavior-identical)
- src/components/shared/header/user-menu/UserMenu.tsx (pure local rename)

## Acceptable extras
- none

## Delta scenario (run AFTER the full run)
1. With seed.patch applied, apply `delta.patch` — it fixes the gateways
   defect (restores the error-returning catch), simulating the parent's
   post-review fix.
2. Dispatch the finder in DELTA mode with (i) the full run's ACTUAL verifier
   report verbatim and (ii) the delta description: "one edit to
   src/gateways/user/index.ts restoring the error return in updateUser's
   catch, fixing the review's integrity finding".
3. Expected: mode=delta (no fallback); the fix confirmed as resolving the
   gateways finding; no whole-project verification re-runs; tokens/time well
   below the full run (this is the measurement of the savings-scale-with-
   unchanged-portion hypothesis — 7 of 8 files unchanged).
