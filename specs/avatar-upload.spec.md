# Transactional avatar upload spec

## States
- received: an authenticated upload request has supplied a server-derived user id and a non-empty file within the size limit.
- rejected: terminal result for an unsupported MIME type or mismatched image signature.
- current-loaded: the current avatar URL has been read from D1.
- staged: a new object exists at a unique owner-scoped R2 key; the old object and D1 row are unchanged.
- persisted: D1 points to the newly staged object.
- rolling-back: D1 rejected the update and the new object is being removed.
- failed: terminal failure; the prior D1 value and prior object remain authoritative.
- succeeded: terminal success; D1 and R2 agree on the new avatar and the prior object is removed when one existed.
- cleanup-pending: terminal success; D1 points to the new avatar, but deletion of the prior object failed.

## Initial state
received

## Actions
| action | from | to | requires | ensures |
|---|---|---|---|---|
| reject-content | received | rejected | MIME is unsupported or bytes do not match MIME; evaluated before any D1 read | returns `Unsupported image type`; no D1 or R2 access occurs |
| load-current | received | current-loaded | MIME and bytes are valid and the D1 read succeeds | reads the current avatar URL without mutating it |
| fail-load | received | failed | MIME and bytes are valid and the D1 read throws | no R2 mutation occurs |
| stage-new | current-loaded | staged | unique key generation and R2 put succeed | new key is `<userId>/avatars/<uuid>.<ext>`; old object and D1 value are unchanged |
| fail-stage | current-loaded | failed | key generation or R2 put throws | D1 and the old object remain unchanged |
| persist-new | staged | persisted | D1 update succeeds and affects exactly one user row | D1 points to the new authenticated `/api/avatars` URL |
| begin-rollback | staged | rolling-back | D1 update throws | prior D1 value is unchanged |
| finish-rollback | rolling-back | failed | deletion of the new object succeeds | new object is removed; prior object and D1 value remain |
| fail-rollback | rolling-back | failed | deletion of the new object throws | failure includes the new orphaned key for operator cleanup |
| finish-without-old | persisted | succeeded | no prior owned avatar key exists | returns the new avatar URL with cleanup state `complete` |
| remove-old | persisted | succeeded | a prior owned key exists and its object deletion succeeds | returns the new avatar URL with cleanup state `complete`; prior object is removed |
| defer-old-cleanup | persisted | cleanup-pending | a prior owned key exists and its object deletion throws | returns the new avatar URL with cleanup state `pending` |

## Invariants
- Rejected content never reaches an R2 put or D1 update.
- Every new object key has the exact `<userId>/avatars/<uuid>.<ext>` form and the read path accepts that form plus the legacy `<userId>/avatar.<ext>` form.
- D1 never points to the new key before its R2 put succeeds.
- The prior object is never deleted before D1 points to the new key.
- A failed D1 update triggers deletion of only the newly staged object.
- A caller-supplied user id or storage key never participates in the flow.
- A prior key is derived only from a relative `/api/avatars?key=...` URL whose key passes `isOwnAvatarKey` for the server-derived user id; external image URLs have no owned key.
- Concurrent uploads use distinct keys and may resolve last-writer-wins; neither flow deletes the key it staged or a key staged after its initial D1 read.

## Forbidden flows
- `rejected` reaches any state that mutates D1 or R2.
- `current-loaded` reaches `persisted` without passing through `staged`.
- `staged` reaches `failed` after a D1 failure without entering `rolling-back`.
- The prior object is deleted from `current-loaded` or `staged`.
- `succeeded` or `cleanup-pending` is reached while D1 still points to the prior avatar.
- Old-object cleanup runs when no prior owned key was derived.

## Requirements
- R1: Unsupported or mismatched images return the existing `Unsupported image type` failure.
- R2: A successful upload returns an authenticated `/api/avatars` URL for a unique owner-scoped key.
- R3: D1 failure preserves the prior D1 value and prior object; rollback removes the new object when possible and otherwise reports its orphaned key.
- R4: After D1 success, prior-object cleanup cannot make the new avatar unavailable.
- R5: Every successful result includes additive cleanup state `complete` or `pending`.
