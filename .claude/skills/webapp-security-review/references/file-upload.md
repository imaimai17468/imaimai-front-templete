# File upload

Draws on chapter 11 (ファイルアップロード).

An upload is input that keeps being processed after it arrives: it is validated, stored, served back and later replaced, and each of those steps trusts something different. A file that passes the first step can still hurt at a later one, for example bytes accepted as an image and then served with a type the browser runs. A review therefore follows one file from the request to its deletion, rather than stopping at the validator.

## Where the decision lives here

The one upload in this repository is the avatar. Its steps, in order:

- **Receive.** The profile form (`src/routes/_authed/profile/-components/profile-form/profile-form.tsx`) offers `accept="image/*"` and checks only the size, and `submitProfile` in `submit-profile.ts` beside it appends the file to a FormData under `avatar` and calls `uploadAvatarFn` in `src/shared/gateway/user/update.fn.ts`. Everything the browser does here can be skipped by calling the server function directly.
- **Validate the envelope.** `parseAvatarUpload`, the validator of `uploadAvatarFn`, requires a `File` under `avatar` and rejects an empty one or one over `MAX_AVATAR_BYTES` (5 MiB, `src/lib/storage/avatar-validation.ts`).
- **Authorize.** `ProfileWriter.uploadAvatar` (`src/shared/gateway/user/update.ts`) fails with `NotAuthenticated` for a signed-out caller and hands the signed-in user's id to `AvatarWriter`. Who may write is `access-control.md`'s subject.
- **Validate the content.** `AvatarWriter.replace` (`src/shared/gateway/user/avatar/update.ts`) takes the file's declared type, maps it through `avatarExtensionForMime` (PNG, JPEG, WebP, GIF, exact match only), then requires `avatarContentMatchesMime` to find that type's signature in the first 12 bytes. The file name is never read.
- **Store.** The key is built by the gateway as `<userId>/avatars/<uuid>.<ext>`, with the extension from the allow-list and the UUID from `AvatarKeyIds`. `AvatarBucket.put` (`src/shared/gateway/user/avatar/index.ts`) writes the original bytes to `AVATARS_BUCKET` with the declared type as `httpMetadata.contentType`.
- **Replace.** The row's `avatar_key` is updated only after the put succeeds. A row update that touches no row deletes the new object again, and the previous object is deleted last, after `isOwnAvatarKey` confirms the stored key belongs to this user; a failed delete leaves `cleanup: "pending"` in the answer rather than failing the upload.
- **Serve.** `src/routes/api/avatars.ts` returns the object with the stored content type (falling back to `image/png`), `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'` and `Cache-Control: private`.

## Checks

**The server repeats every check the form makes.** Compare the form's checks with the validator's. The code is right where each limit the browser applies (today, the size) is applied again in `parseAvatarUpload` or the gateway, as the comment above `AvatarFileSchema` records. It is wrong where a limit exists only in the component, because `uploadAvatarFn` is a plain POST anyone signed in can send.

**The file name never reaches the key.** Read how `AvatarWriter.replace` builds `key`. It is right while every segment comes from the session, the allow-list or `AvatarKeyIds`. It is wrong the moment `file.name`, or anything else from the request, is interpolated, because the name is attacker-chosen text; `path-traversal.md` covers what such a key could then reach.

**The type is decided by content, and the allow-list is the list of formats the feature needs.** `avatarExtensionForMime` accepts four exact MIME strings and nothing else, so `image/svg+xml` and `text/html` fail before the bytes are read. Adding a format adds a decoder that every browser viewing the avatar will run; SVG in particular is a document that can carry script, so it stays out unless a feature needs vector avatars and serves them from another origin.

**A signature check is not a decode.** `avatarContentMatchesMime` compares 8 bytes for PNG, 3 for JPEG, 6 for GIF, and for WebP 4 bytes at offset 0 and 4 at offset 8, and the original bytes are stored unchanged. A file that opens with a PNG signature and continues with HTML is accepted and served back byte for byte (see the reproduction below). What keeps it inert today is the serving step: a fixed image `Content-Type`, `nosniff`, and a `default-src 'none'` policy. A change that serves these objects without those three headers (a public bucket URL, a custom domain on the bucket, or a new route) turns this into stored content the browser may render. The same applies to metadata: EXIF blocks, such as a GPS position, are kept, which matters once avatars are shown to anyone other than their owner. Re-encoding the pixels into a new image removes both, and no image library is pinned in this repository for doing that on a Worker, so choosing one is part of that change.

**Pixel dimensions are not bounded.** The 5 MiB ceiling bounds bytes; nothing here decodes the image, so a small file with huge dimensions costs the Worker nothing. The cost lands on each browser that decodes it. Where a server-side decoder is added, give it a width, height and total-pixel ceiling of its own before it allocates.

**The request body is bounded before the validator runs, by the platform.** `parseAvatarUpload` sees a parsed `FormData`, so the size check runs after the body has been read. Cloudflare's documented request body limit is 100 MB on the Free and Pro plans (Workers limits page, read 2026-09-30); a body under that and over 5 MiB is received and then rejected. Rate limits and per-user quotas are not implemented under `src/`. Uploads one after another leave one live object per user, because `replace` deletes the previous one, apart from objects a failed delete leaves behind, which only `reportError` records. Two uploads from one account at the same time both read the same previous key, both put a new object and both set the row, so the object whose row write lost stays in the bucket with no row naming it and nothing reported. A per-user bound needs the row update to require the previous key it read (`where avatar_key = previousKey`) or a quota.

**The stored type is the type that was validated.** `AvatarBucket.put` receives `file.type`, the same string `avatarExtensionForMime` and the signature check accepted. Objects written before that hardening may carry other types: the comment above `AVATAR_READ_EXTENSIONS` says legacy keys took their extension from the client's file name. Where such objects may remain in a deployed bucket, open the bucket in the Cloudflare dashboard and check the content type of each object under a `<userId>/avatar.<ext>` key, because `/api/avatars` serves whatever `httpMetadata.contentType` says.

**Replacing an object never removes the only valid copy first.** Read `replace` from the put to the final `remove`. It is right in its current order: put, row update, then delete the previous object. It is wrong where the old object is deleted before the row points at the new one, because a failure between the two leaves the row naming a deleted object.

**The serving headers apply only while `/api/avatars` is the way in.** A public bucket URL skips the ownership check, which `access-control.md` covers, and it also drops the `nosniff` and CSP headers that keep an accepted signature-then-HTML object inert. `wrangler.toml` binds `AVATARS_BUCKET` and declares no public URL, but public access (an `r2.dev` URL or a custom domain) is turned on in the Cloudflare dashboard, so check the bucket's settings there.

## Reproduce locally

Send the upload without the form, so the browser's `accept` and size check are out of the path. On `bun run dev`, sign up an account with `curl -c jar -H "Origin: <dev URL>" -H 'Content-Type: application/json' -d '{"email":"a@example.com","password":"password-aaaa","name":"A"}' <dev URL>/api/auth/sign-up/email`. Fetch `<dev URL>/src/shared/gateway/user/update.fn.ts` and take the argument of the `createClientRpc("…")` call whose decoded id names `uploadAvatarFn` (the id is base64 JSON naming the export), which is that server function's id in the dev build (this is how `@tanstack/start-client-core`, as pinned here, addresses a server function). Then send each file with `curl -b jar -H "Origin: <dev URL>" -H 'x-tsr-serverFn: true' -F 'avatar=@<file>;type=<type>;filename=<name>' <dev URL>/_serverFn/<id>`.

Every answer is HTTP 200, including the rejections, so read the body rather than the status line: a gateway rejection carries `status: "failed"` and a `message`, and a validator rejection comes back as a serialized error whose message the table quotes. Then check the bucket. On 2026-09-30 these came back:

| File sent | Body says | What it means |
| --- | --- | --- |
| text bytes, `type=image/png` | `Unsupported image type` | the signature check ran and the declared type alone was not trusted |
| PNG signature then HTML, `type=text/html` | `Unsupported image type` | the allow-list rejected the declared type |
| PNG signature then HTML, `type=image/png`, `filename=../../evil.png` | `uploaded`, `avatarUrl` with `<userId>/avatars/<uuid>.png` | the name was ignored, and a prefix-only check let the HTML through |
| 5 MiB + 1 byte | `Avatar must be 5MB or smaller` | the validator's ceiling holds without the form |
| no session cookie | `Not authenticated` | the gateway refused before touching the bucket |

Request the `avatarUrl` of the accepted upload with the same cookie. It answered `200` with `content-type: image/png`, `x-content-type-options: nosniff` and `content-security-policy: default-src 'none'`, and the HTML bytes intact; a missing header in that list is the finding. Upload a second file and request the first `avatarUrl` again: `404 Not found` means the previous object was deleted. A `400 Invalid key` there proves nothing about deletion, because it means the key was malformed or not yours.

## Fix and pin

Keep the file name out of every value the server stores, derive the type from content through the allow-list, and keep the serving headers in `getAvatarResponse`, where `src/routes/api/-avatars.test.ts` already asserts all of them in one object. A new format goes into `AVATAR_MIME_TO_EXTENSION` together with its signature in `matchesSignature`, and `src/lib/storage/avatar-validation.test.ts` takes an accepted row and a mismatched row for it.

For a rejection, pin that nothing was written as well as the message: `src/shared/gateway/user/avatar/update.test.ts` provides fake `AvatarBucket`, `AvatarKeyIds` and `UserAvatarKeys` layers, so a test can assert the result and the bucket calls in a single `toStrictEqual`, and its rollback cases already cover each failed step of the replace.
