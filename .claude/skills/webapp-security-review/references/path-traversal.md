# Path traversal

Draws on chapter 12 (Path Traversal).

Path traversal is a request that names a location the server joins onto a base it trusts, and reaches something outside that base. `../` is the familiar spelling, and the defect is the join rather than the string: an absolute path, a double-encoded separator, or a value read back from the database can cross the same boundary. The question for a review is how much of the location the request gets to decide.

## Where the decision lives here

This Worker stores nothing on a disk it keeps. The "path" is an R2 object key in `AVATARS_BUCKET`, and the base it must stay inside is the caller's own prefix, `<userId>/`.

R2 has no directories to climb out of. Its documentation (Objects page, read 2026-09-30) describes a flat store in which `/` only groups keys by prefix, and it documents no normalization of `..`, so treat the key `a/../b` as a distinct object rather than `b` (not tried against R2 here; the pattern below refuses such a key before the bucket sees it). On R2 a traversal is a key that lands in another user's prefix, or on an object this app did not write, and ownership decides both, so the boundary below is the same one `access-control.md` names.

- **Write.** `AvatarWriter.replace` (`src/shared/gateway/user/avatar/update.ts`) builds the key itself, as `<userId>/avatars/<uuid>.<ext>`, from the session's id, `AvatarKeyIds` and the MIME allow-list. The request supplies no part of it.
- **Read.** `src/routes/api/avatars.ts` passes the `key` query parameter to `AvatarReader.read` (`src/shared/gateway/user/avatar/read.ts`), which requires `isOwnAvatarKey(key, callerId)` before `AvatarBucket.get`.
- **Delete.** The previous object's key comes from the `avatar_key` column, and `replace` requires `isOwnAvatarKey` on it before `AvatarBucket.remove`, because a stored value is still a source: whatever wrote the column could have written another user's key.

`isOwnAvatarKey` (`src/lib/storage/avatar-validation.ts`) matches the whole key against one anchored pattern: an owner segment of `[A-Za-z0-9_-]+`, then exactly `avatar.<ext>` or `avatars/<uuid>.<ext>`, with an extension from the read allow-list, and then compares the owner segment with the caller's id for equality.

A filesystem does exist under `nodejs_compat`: with this repository's compatibility date, `node:fs` gives a Worker a per-request, memory-backed tree with the bundle read-only under `/bundle` and a writable `/tmp` (Cloudflare's `node:fs` page, read 2026-09-30). Nothing under `src/` imports `node:fs` today, so no request value reaches it.

## Checks

**Every key the bucket sees is built by the server or matched whole before use.** Run `git grep -n -e 'AVATARS_BUCKET' -e 'bucket.get' -e 'bucket.put' -e 'bucket.remove' -- src` and follow each call's key back to where it was built. It is right where the key came from the session and `AvatarKeyIds`, or passed `isOwnAvatarKey` for the caller's id. It is wrong where a request value, or a column, reaches the binding without passing through one of those, even if it passed a `replace("../", "")` or a `startsWith` first, because a filter that removes bad substrings leaves every spelling it did not predict.

**Ownership compares segments, never string prefixes.** The owner segment is compared for equality after the pattern splits it off, and `avatar-validation.test.ts` pins the case "caller id is a prefix of the key's owner" (`user-12/avatar.png` for caller `user-1`). A new `AVATARS_BUCKET.list({ prefix })` has to pass `<userId>/` with the trailing slash, because the prefix `user-1` also lists `user-12`'s objects and no current test covers a listing.

**A value that names a file is chosen from a list the server holds.** Where a feature lets the request pick a template, a locale, a theme or a document, the request sends a logical id and the server maps it to the key or path, returning 404 for an id that is not in the map. A request that sends the key itself is the design this check rejects, whatever validation follows it.

**A delete, a copy or an export takes the same check as the read.** `access-control.md`'s "Every path to the same data" check applies to each binding call the first check above lists; for keys the consequence is that an unchecked `remove` destroys another user's object even where every `get` is guarded.

**`node:fs` stays unreachable from request values.** Run `git grep -n 'node:fs' -- src`. No hits is the current state. A hit that joins a request value onto `/tmp` or `/bundle` needs a fixed base, a join that refuses to leave it, and a containment check on the resolved path; the bundle holds this Worker's code, so a read that escapes into `/bundle` discloses it.

**An archive is a list of paths.** No feature here accepts one. A feature that unpacks a ZIP into R2 keys must build every key itself and use the entry name at most as display text, and bound the entry count and the expanded size before writing.

## Reproduce locally

Replay keys around one that exists, so a 404 has a meaning. On `bun run dev`, sign in, upload an avatar, copy the `key` from the avatar image's `src`, and decode it once to get `<userId>/avatars/<uuid>.<ext>`. With the same session cookie, request `/api/avatars?key=` followed by each variant below, URL-encoded as a whole. On 2026-09-30 these came back:

| Key sent | Answer | What it means |
| --- | --- | --- |
| the copied key | `200`, the image | the baseline: the key and the session work |
| `<userId>/../../x.png` | `400 Invalid key` | the pattern refused the segments before the bucket was read |
| `/<userId>/avatar.png` | `400 Invalid key` | a leading slash is not a valid owner segment |
| `<userId>%2Favatar.png`, encoded a second time | `400 Invalid key` | the route decodes once, and the pattern did not match the leftover `%2F` |
| the copied key with the UUID's last character changed to another lowercase hex digit | `404 Not found` | the key was well formed and yours, and nothing was stored there; it says nothing about traversal |

A `200` for any variant other than the baseline is the finding, and so is a `404` for one of the `400` rows, because a `404` means the key reached `AVATARS_BUCKET.get`.

## Fix and pin

Build the key on the server from the session and a generated id, and where a key must arrive from outside, match it whole with an anchored pattern and compare the owner segment for equality, as `isOwnAvatarKey` does. A new key shape goes into `AVATAR_KEY_PATTERN` together with a row in each of `isOwnAvatarKey`'s accepted and rejected tables in `src/lib/storage/avatar-validation.test.ts`, including a traversal, a nested path and a prefix-sharing owner. At the gateway, `src/shared/gateway/user/avatar/read.test.ts` pins that a refused key never reaches the bucket, and `update.test.ts` does the same for a stored key naming another owner on the delete path.
