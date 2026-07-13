# fx-06 (clean diff — false-positive probe)
base: 6b4a56dbdc463e5fd8a4e5ec098f74884de6fed2

## Expected findings
- none. The seed is a behavior-identical refactor (extracting the 5MB
  avatar size limit into a named module constant in ProfileForm.tsx).

## Acceptable extras
- none. ANY surviving CONFIRMED finding on this fixture counts as a false
  positive. (PLAUSIBLE-but-not-confirmed suggestions score as FP too — the
  point is measuring over-reporting.)
