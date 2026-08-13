# fx-09 (authorization and persistence boundary)
base: 3197d7722c04ce850eccd95578a7ba4061a90ba4

The route performs an R2 read for a caller-supplied key before the server
authorization boundary validates the session and ownership. This reproduces the
architecture class missed before ADR-0016's 2026-08-13 amendment.

## Expected findings
- file: src/routes/api/avatars.ts
  nature: the route imports a gateway directly and reads an untrusted avatar key
  before `readAvatarForCurrentUser` authenticates the request. Anonymous or
  authenticated callers can trigger R2 reads for foreign keys, bypassing both the
  route → server/fn → gateway import direction and the authorization boundary.
  severity-floor: major

## Acceptable extras
- The redundant R2 read adds unnecessary latency and cost to every request with a
  key.
- The seeded diff violates `arch-rules/layer-boundaries` and makes lint fail.
