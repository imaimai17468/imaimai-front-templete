# fx-07 (multi-file mixed — discrimination probe)
base: 6b4a56dbdc463e5fd8a4e5ec098f74884de6fed2

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
