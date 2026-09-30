# Data processing

Draws on chapter 16 (XML・シリアライズ・データ処理).

A parser or deserializer turns request bytes into a value before any validator sees it, and some formats let the bytes steer that step: an XML entity makes the parser read a file or a URL, an object-rebuilding format resolves classes and runs their code while it decodes, and a small nested or compressed input expands into something large. The question for each entrance is what the parser may do with bytes a caller chose, because a check that runs after the parse cannot undo what the parse already did.

## Where the decision lives here

The server-function handler parses the body, and the validator only ever sees its result (`node_modules/@tanstack/start-server-core/dist/esm/server-functions-handler.js`, version 1.169.31):

- A `multipart/form-data` or `application/x-www-form-urlencoded` POST is parsed by `request.formData()`, and the validator receives that `FormData`. The form's context entry is taken out first and parsed by seroval's `fromJSON` with the plugins listed next.
- An `application/json` POST is parsed by `request.json()` and then by seroval's `fromJSON`, which rebuilds the value types seroval knows plus those of the registered plugins. The plugins are TanStack Router's `ShallowErrorPlugin`, `RawStreamSSRPlugin` and `ReadableStreamPlugin`, plus one per `serializationAdapters` entry in the Start options, of which `src/` registers none.
- On every path the caller's `context` is merged under the server's with `safeObjectMerge` (`node_modules/@tanstack/start-client-core/dist/esm/safeObjectMerge.js`), so a server key wins a collision and a key only the caller set arrives as the caller wrote it.
- A GET carries the same seroval JSON in its `payload` query parameter, and that is the only path with a size check before parsing: the handler throws `Payload too large` past 1,000,000 characters.

The validator then decodes the parsed value with Effect `Schema`, as `parseProfileUpdate` in `src/shared/gateway/user/update.fn.ts` does, and `input-validation.md` covers that step.

Two topics of the chapter have no counterpart here, each checked on 2026-09-30:

- **XML external entities.** Nothing parses XML: `git grep -n -i -e xml -e DOMParser -- src package.json` finds only `image/svg+xml` as a favicon type and as a MIME type the avatar tests expect to be refused.
- **YAML loaders.** `yaml` is a devDependency, imported only by `scripts/claude-frontmatter.ts`, which reads this repository's own files rather than a request.

Object-rebuilding deserialization has a near counterpart. Nothing in `src/` rebuilds a class by name, and `git grep -n -e 'eval(' -e 'new Function' -- src` finds nothing, but the wire parser is seroval's `fromJSON`, which rebuilds more than JSON's plain data and runs each plugin's decode code. What it may build is set by seroval 1.6.3 and the registered plugins, so the adapter check below is where this class enters.

## Checks

**Each entrance names the formats it accepts, and each format's parser is known.** For every hit of `git grep -n -e 'createServerFn(' -e 'handlers:' -- src`, write down the content types that reach it and the function that parses each. A server function accepts every body its declared method allows, whatever its validator expects: a POST function takes both POST bodies, a GET function takes the `payload` parameter, and any other method is answered 405 before parsing. The validator is what refuses the shapes it does not expect: `FormDataSchema` in `update.fn.ts` accepts only a `FormData` instance, and no registered plugin rebuilds one from JSON, so a JSON body to `updateProfileFn` fails with `Expected FormData`. A file route under `src/routes/api/` parses nothing unless its handler calls `request.formData()`, `request.json()` or `request.text()`; `src/routes/api/avatars.ts` reads only a query parameter. The code is right where each parsed value is decoded from `unknown` before use. It is wrong where a handler casts or destructures a parsed body directly.

**A registered serialization adapter is reviewed as a deserializer.** An entry added to `serializationAdapters` lets any caller's JSON body, GET `payload` or form context entry build that type on the server before the validator runs.

**A key a middleware reads from `context` is set by server middleware.** A key no server middleware sets arrives from the request body, because the handler merges the caller's `context` in. `src/` has no middleware today, so this check binds the first one added. Read the adapter's decode side as code a stranger drives: it is wrong where it calls a constructor, resolves a name, or allocates in proportion to a count the payload states.

**Size is bounded before the bytes are parsed.** No POST path above checks the body's size before `request.formData()` or `request.json()` reads it, so the bound is whatever limit Cloudflare places on a request body; that limit depends on the account's plan, and this reference did not confirm it. `MAX_AVATAR_BYTES` (`src/lib/storage/avatar-validation.ts`) is checked by `AvatarFileSchema` on a `File` that has already been parsed into memory, so it bounds what reaches R2 and not what the Worker parsed. Where an entrance needs a lower ceiling, compare `Content-Length` with it before calling the parser, and still count the bytes actually read, because the header is the caller's claim.

**A file whose format is itself a document is refused or neutralized.** SVG is XML, and a browser runs script inside it. `avatarExtensionForMime` and `avatarContentMatchesMime` in `src/lib/storage/avatar-validation.ts` accept PNG, JPEG, WebP and GIF only and compare the leading bytes with that type's signature, and `AvatarObject.response()` in `src/shared/gateway/user/avatar/index.ts`, the only way a route or component reaches an object's bytes because `arch-rules/layer-boundaries` bans `src/lib/cloudflare` from both, serves each with the image type its key names, `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'`. A new upload path is right where it holds the same two guards.

**A stored value is decoded again when it is read.** The origin of a value decides its trust, and D1 holds what users wrote. A read is right where the row goes through a `Schema` decode, as `ProfileRowSchema` in `src/shared/gateway/user/read.ts` decodes the row `findProfile` reads. `UserAvatarKeys.find` in `src/shared/gateway/user/avatar/update.ts` takes `avatarKey` without one, and a later step treats that value as a bucket key, so review that use as input handling. Either way, a value a user supplied stays a value at every later query (`sql-injection.md`) and at every render.

**A parse failure answers with a fixed message.** The handler sends a thrown `Error`'s `message` to the client. On 2026-09-30 a JSON body that was not in seroval's format answered 500 with seroval's own message, which named the library and quoted the `TypeError` it hit. Nothing about a row leaked, but the answer tells a caller which deserializer is behind the endpoint; weigh that where the parser's messages carry more, and log the detail rather than returning it.

**A new format starts from JSON.** Where an import or a webhook needs a format, choose one that decodes to plain data, decode it with a `Schema` at the wire, and bound its size, depth and item counts before or during the parse. Where XML cannot be avoided, the parser's own documentation has to say that DTDs and external entities are refused, and a test sends a document with an external entity and expects a rejection with no file or network read.

## Reproduce locally

Replay the profile write with its format changed, and with two fields the schema does not declare. Run `bun run db:push:local`, start `PORTLESS=0 bun run dev` (it serves `http://localhost:5173`), sign in on `/login` as the dev user, and copy from the Network panel the request the profile page's Save button sends to `/_serverFn/...`. Send it again with `curl`, keeping the session cookie and the `x-tsr-serverFn: true` header, first with `-H 'Content-Type: application/json' -d '{"data":{"name":"x"}}'` in place of the form, then as a form with `-F name=ok -F role=admin -F email=evil@example.com`. Read the row with `bunx wrangler d1 execute DB --local --command "select * from users"` after each.

On 2026-09-30 the JSON body answered 500 with seroval's message and left the row unchanged, which shows the deserializer refused bytes outside its format before the validator ran. It proves nothing about a well-formed seroval payload, which was not tried and which `FormDataSchema` would have to refuse instead. The form with `role` and `email` answered 200 with `"updated"`, and the row changed only its `name` while `email` kept `dev@example.com`, which is the result expected of an undeclared field. A row whose other columns changed would mean a field outside the schema reached the write.

## Fix and pin

Put the refusal at the step where the bytes are still bytes: a size ceiling before the parser, a parser configured to do nothing but build data, and a `Schema` decode from `unknown` right after it. Keep what a caller may send down to one format per entrance where the feature allows it.

Pin the validator's refusal of every other shape, as `src/shared/gateway/user/update.fn.test.ts` already does for a value that is not `FormData`. For a new format or adapter, add a test that sends the hostile input (an external entity, a payload that states a count far beyond its bytes, a body one byte over the ceiling) and asserts in one `toStrictEqual` both the rejection and that the store or the fake reader it would have reached was not called.
