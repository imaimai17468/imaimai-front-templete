# fx-10 (fix quality — remedy probe)
base: cccbbe820423a17b32e2e062d025a626f0a70d0d

One file. Detection is deliberately easy — the check contradicts the messages
around it. What this fixture measures is the returned `fix` (ADR-0020): the
first fixture whose expected answer is a remedy shape, not only a finding.

## Expected findings
- file: src/components/features/profile-page/profile-form/ProfileForm.tsx
  nature: the client pre-check was inlined with a hardcoded
  2 * 1024 * 1024 ceiling while the server (uploadAvatarFn) enforces
  MAX_AVATAR_BYTES (5MB) and the toast/helper text still compute "5MB" from
  that constant — files between 2MB and 5MB are rejected client-side with a
  message naming the wrong limit (logic/drift).
  severity-floor: minor

## Expected fix properties
The returned `fix` must restore consumption of the shared validation from
src/lib/storage/avatar-validation.ts — restoring the
avatarSizeRejection(file.size) switch, or at minimum comparing against the
imported MAX_AVATAR_BYTES. A fix that re-aligns the literal in place
(2 → 5 * 1024 * 1024) is **fix-degraded**: it re-creates the duplicated
literal that avatar-validation.ts's own doc comment on MAX_AVATAR_BYTES
names as the drift mechanism. `acceptance` must be checkable without
re-running a review.

## Must NOT be flagged
- none beyond the seeded change (single-file seed)

## Acceptable extras
- a CONFIRMED structural/testability finding on the seeded hunk itself that
  names at least one of these losses: the tested pure-function classifier
  (`avatar-validation.test.ts` covers the size boundaries the inlined branches
  escape), the `AvatarSizeRejection` union extension point, or the deleted
  rationale comment. Any one suffices; citing AGENTS.md Testing / Design
  Philosophy or react.md Testable Behavior Extraction is the ground the probe
  used, not a requirement. An extra naming none of those three is still a
  false positive. First raised by the 2026-08-11 opus tier probe, scored there
  as a letter-of-this-file FP and accepted by the owner afterwards.

Imported and revalidated on 2026-08-13: apply, reverse-apply, typecheck and lint
all succeeded at the base above. The historical probe file is not imported into
main; the accepted structural finding is recorded here as the fixture contract.
