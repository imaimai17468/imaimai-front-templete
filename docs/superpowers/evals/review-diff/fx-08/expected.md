# fx-08 (large mixed diff — realistic-scale probe)
base: ce149e0 (regenerated 2026-07-29; any tree where seed.patch applies)

Eight files: six benign edits + two seeded defects. Measures (a) detection
inside a noisy multi-file diff and (b) FP resistance on the benign majority.

## Expected findings
- file: src/gateways/user/index.ts
  nature: updateUser's catch now returns { success: true } — a DB write
  failure is swallowed and reported as success (integrity).
  severity-floor: major
- file: src/lib/storage/avatar-validation.ts
  nature: avatar size check inverted (`>` → `<`) — uploads UNDER the ceiling
  are rejected as "too-large" while oversized ones pass (logic/inverted
  condition), defeating the server-side enforcement in uploadAvatarFn.
  severity-floor: major

## Must NOT be flagged (each counts as an FP if a CONFIRMED finding survives)
- src/lib/utils.ts, src/lib/auth/actions.ts, src/test-setup.ts,
  src/server/cloudflare.ts (comment/JSDoc additions)
- src/routes/login.tsx (label extracted to a constant, behavior-identical)
- src/components/shared/header/user-menu/UserMenu.tsx (pure local rename)

## Acceptable extras
- none

## Detection is not blind here
The size defect breaks `src/lib/storage/avatar-validation.test.ts`, so a reviewer
that runs the suite finds it immediately. That makes the *detection* half of this
fixture easy on purpose — its discriminating half is the six benign files. fx-01
has the same property.

## Regeneration note (2026-07-29)
The original seed referenced `src/lib/auth.ts`, which the 2026-07-25 audit's W10
item renamed to `src/lib/auth/actions.ts`, and put the size defect in
ProfileForm.tsx, where the check no longer lives. Three of eight hunks stopped
applying, so the fixture was rebuilt to the same shape (six benign + two defects,
same defect natures) against the current tree.

Two lessons from that rebuild, kept because they cost a run:

- The first rebuild's "benign" comments were not benign. One asserted that jsdom
  has no `scrollTo` (it defines a not-implemented stub), one asserted when
  better-auth's `signIn.social` promise resolves, and a third declared a constant
  between two imports. The finder flagged all three, correctly, citing AGENTS.md
  Knowledge Currency — so that run's FP measurement was void, and not a reviewer
  error. A benign edit must assert nothing verifiable.
- **The correction was wrong too.** The replacement comment said the override
  exists "so components that scroll can render under jsdom" — also false: jsdom's
  `scrollTo` emits a `jsdomError` that vitest forwards to `console.error`, so it
  never throws and rendering is unaffected. The review of the *results file*
  caught it, one layer later. Two attempts at a one-line comment produced two
  false claims, which is the argument for the rule the third attempt follows:
  describe what the code does, assert nothing about why it is needed.
- `delta.patch` was deleted rather than regenerated: ADR-0019 removed delta mode.
