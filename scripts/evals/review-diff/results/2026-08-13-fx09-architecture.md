# fx-09 architecture-boundary eval

- Date: 2026-08-13
- Fixture: `fx-09`
- Baseline: `3197d7722c04ce850eccd95578a7ba4061a90ba4`
- Model: GPT-5.6 Sol
- Effort: standard
- Subagent tokens: unavailable
- Wall time: unavailable

## Score

- Expected findings found: 1 / 1
- Expected findings missed: 0
- False positives: 0
- Candidates: 2
- Refuted: 0

Both surviving findings describe the same seeded defect from its two required
facets: the caller-supplied key reaches R2 before authorization, and the route
imports a gateway across the documented layer boundary.

## Fix and acceptance quality

- Both fixes remove the direct gateway read and retain the existing
  `readAvatarForCurrentUser` boundary.
- The first acceptance check is checkable across the named route test and
  `src/server/fn/avatar.test.ts`; its command alone does not verify the gateway
  call count.
- The second acceptance check is directly executable.
- No decision-needing finding invented an answer.

The returned report is saved verbatim at
`results/2026-08-13-fx09-architecture/fx-09.md`. The seed patch was reversed and
the working tree returned to the committed baseline before this result was
written.
