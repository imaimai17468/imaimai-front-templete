# fx-06 (clean diff — false-positive probe)
base: ce149e0 (regenerated 2026-07-29; any tree where seed.patch applies)

## Expected findings
- none. The seed is a behavior-identical refactor: the repeated expression
  `MAX_AVATAR_BYTES / 1024 / 1024` is extracted into a module-scope
  `MAX_AVATAR_MB` constant in ProfileForm.tsx and both call sites now read it.

## Acceptable extras
- none. ANY surviving CONFIRMED finding on this fixture counts as a false
  positive. (PLAUSIBLE-but-not-confirmed suggestions score as FP too — the
  point is measuring over-reporting.)

## Regeneration note (2026-07-29)
The original seed extracted an inline `5 * 1024 * 1024` literal in
ProfileForm.tsx into a named constant. That premise disappeared when the
2026-07-25 audit's W2 item moved the ceiling into
`src/lib/storage/avatar-validation.ts` as the shared `MAX_AVATAR_BYTES`, so the
patch stopped applying. The seed was regenerated to the same *kind* of change —
naming a repeated size expression, behavior-identical — against the current
tree, and verified lint/format/typecheck/test clean before use. The prior
measurements in `results/2026-07-12-noise-suppression.md` remain comparable in
nature, not in content.
