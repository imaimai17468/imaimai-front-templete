# fx-07 (multi-file mixed — discrimination probe)
base: cccbbe820423a17b32e2e062d025a626f0a70d0d

Two files: one benign edit + one seeded defect. Measures discrimination —
finding the real defect while NOT flagging the benign change.

## Expected findings
- file: src/components/features/profile-page/profile-form/ProfileForm.tsx
  nature: setPendingFile(null) moved BEFORE the avatarResult error check —
  on upload failure the pending avatar file is discarded, so a retry
  submits without the avatar (silent data loss on retry; preview state also
  desyncs from pendingFile).
  severity-floor: minor

## Must NOT be flagged
- src/components/shared/header/user-menu/UserMenu.tsx — pure local rename
  (avatarUrl → avatarSrc, declaration + single usage). A surviving
  CONFIRMED finding here counts as a false positive.

## Acceptable extras
- none

## Regeneration note (2026-08-11)
Both hunks stopped applying: ProfileForm's error check gained
`!== undefined`, and UserMenu's declaration block and Avatar markup were
both rewritten (name fallback, `|| undefined` → `?? undefined` on the
avatar src, `h-8 w-8` → `size-8`), so the 2026-07 seed's context lines no
longer matched. Rebuilt to the same shape — same defect
nature (setPendingFile(null) hoisted above the error check), same benign
rename — against the current tree; typecheck and lint verified clean with
the seed applied.

Revalidated on 2026-08-13 after importing the regenerated patch into main:
apply, reverse-apply, typecheck and lint all succeeded at the base above.
