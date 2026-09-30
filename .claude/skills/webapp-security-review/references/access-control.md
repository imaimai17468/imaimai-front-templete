# Access control

Draws on chapter 6 (アクセス制御の脆弱性).

Access control fails with requests that are valid HTTP: an id changed by one digit, a route the UI never links to, a server function called without the page that normally calls it. No attack string is involved, so input validation does not catch it and nothing but the policy check does.

## Where the decision lives here

A `gateway/` directory is the authorization boundary. Its boundary service reads the caller from `CurrentSession` (`src/lib/auth/session/index.ts`, where `None` is a signed-out request) and decides before it reaches D1 or R2. Find the boundaries as the services under a `gateway/` directory whose `layerNoDeps` yields `CurrentSession`, or yields another service that does. For example:

- `CurrentUserReader` in `src/shared/gateway/user/read.ts` reads the profile row of the caller's own id and of no other.
- `ProfileWriter` in `src/shared/gateway/user/update.ts` fails with `NotAuthenticated` where no user is signed in, and writes only the signed-in user's row, whose id it takes from the reader rather than from the request.
- `AvatarReader` in `src/shared/gateway/user/avatar/read.ts` answers `AvatarUnauthorized` to a signed-out request and `AvatarInvalidKey` to a key that `isOwnAvatarKey` (`src/lib/storage/avatar-validation.ts`) does not tie to the caller's id, before it reads the bucket.

The `_authed` layout route (`src/routes/_authed/route.tsx`) redirects a signed-out visitor to `/login`. It decides which page to show and authorizes nothing, because a server function or an `/api/` route is reachable without the page.

## Checks

**Every entrance reaches a boundary that reads the session.** Run `git grep -n -e 'createServerFn(' -e 'handlers:' -- src` and follow each hit's handler to the service it calls. `src/routes/api/auth.$.ts` hands the request to Better Auth, which issues the session itself, so it belongs to authentication rather than to this check. The code is right where that service yields `CurrentSession`, directly or through another boundary as `ProfileWriter` does through `CurrentUserReader`. It is wrong where a handler reaches `getDb()`, a bucket, or a query helper in a gateway's `index.ts` without passing through one, because those helpers take an id and hold no check of their own.

**The object is derived from the caller, or checked against the caller.** Read the validator of each `createServerFn` (`parseProfileUpdate` in `src/shared/gateway/user/update.fn.ts` is one) and every `searchParams.get` in `src/routes/api/`. Where no id arrives from the client, the boundary chooses the object from the session, which is what `ProfileWriter` does. Where an id does arrive, as the avatar `key` does, the boundary must compare it with the caller before any read. An id that is hard to guess, such as a UUID, narrows who can find the object and authorizes nothing.

**Reading and writing are separate decisions.** A boundary that lets a caller read an object says nothing about writing it. Where one gateway directory holds both `read.ts` and `update.ts`, check each against its own row of the policy table.

**Every path to the same data applies the same policy.** A row reached by a loader, by a server function called directly, and by an `/api/` route is three paths, and a file in R2 is one more wherever the bucket has a public URL, which skips `/api/avatars` and its check. A new listing, search, export or notification that returns fields of a row carries the same check as the page showing that row, or it leaks what the page protects.

**The decision denies by default.** Each boundary answers the signed-out case first and allows only what it has matched, as the three above do. A check phrased as "deny when X", with everything else passing through, opens a hole each time a new role, state or entrance is added.

**A response only its caller may see is not stored by a shared cache.** `AvatarObject.response` in `src/shared/gateway/user/avatar/index.ts`, the only way `/api/avatars` reaches an object's bytes, sends `Cache-Control: private` for this reason. A new session-gated response without it can be answered from a shared cache in front of the Worker to a different reader, without the check running at all.

**Choose between 403 and 404 once per kind of object.** A 404 hides whether the object exists and a 403 admits it; either is a choice to record, and the page and the API answer the same object alike. A 404 still leaks existence where a listing, a response length or the timing differs. `/api/avatars` answers 400 to a key it does not tie to the caller, before it reads the bucket, so that answer says nothing about whether the object exists; a new kind of object records its own status the same way.

## Reproduce locally

Replay a key that exists, because a key no upload wrote answers 404 whether the check holds or not. On `bun run dev`, sign in as account B, upload an avatar, and copy the avatar image's `src`, which `avatarUrlForKey` (`src/lib/avatar-url.ts`) builds as `/api/avatars?key=` followed by B's encoded key. Sign in as account A in another browser profile and request that exact URL. A 400 `{"error":"Invalid key"}` means the check holds, a 200 with image bytes means A read B's object, and a 404 means the key was never a stored object, so the step proved nothing. The same request with no session cookie answers 401.

For a boundary with no route to call by hand yet, drive its `layerNoDeps` from a test, providing a `CurrentSession` layer that answers signed out, or signed in as a user other than the object's owner. That is how `src/shared/gateway/user/avatar/read.test.ts` reaches every denial without a session cookie or an R2 binding, by providing fake `CurrentSession` and `AvatarBucket` layers.

## Fix and pin

Put the check in the boundary service, so every entrance that reaches the data goes through it, and write the ownership rule as a pure function that takes the caller and the object, as `isOwnAvatarKey` does, so the function's own test covers every row.

Test the boundary with one case per row of the policy table: signed out, the owner, and another signed-in user, with an allowed row for every denied one. For a denied row, assert in one object that the answer is the denial and that the store was not touched. `read.test.ts` asserts `{ fetchCalls: [], result: new AvatarInvalidKey() }` in a single `toStrictEqual`, which fails both where the denial is missing and where the bucket was read before the check.
