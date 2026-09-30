# SQL injection

Draws on chapter 7 (SQLインジェクション).

SQL injection happens when a value from a request becomes part of the SQL text a database parses, instead of travelling beside it as a bound parameter. The value then changes what the statement does: a quote closes a string literal, and what follows is read as a condition, a comment or a second clause. The class is decided by whether the code mixed the value into the statement's source, whatever characters the value holds.

## Where the decision lives here

Every query in `src/` is built with Drizzle's query builder on the D1 database `getDb()` returns (`src/lib/drizzle/db.ts`). `UserProfiles.findProfile` in `src/shared/gateway/user/read.ts` is `select().from(users).where(eq(users.id, userId))`, and `writeUserRow` in `src/shared/gateway/user/index.ts` is `update(users).set(...).where(eq(users.id, userId))`, and `UserAvatarKeys.find` in `src/shared/gateway/user/avatar/update.ts` selects `avatarKey` the same way. Drizzle's SQLite dialect renders every value as a `?` placeholder and hands the value to D1 separately (`escapeParam` in `node_modules/drizzle-orm/sqlite-core/dialect.js` returns `"?"`), so none of these queries can be injected through its values.

The class comes back only where code writes SQL text itself. In the installed Drizzle (0.45.2) those places are:

- `sql.raw(str)`, which puts `str` into the statement verbatim (`node_modules/drizzle-orm/sql/sql.js`).
- `run`, `all`, `get` and `values` on the database object, which accept a plain string and wrap it in `sql.raw` (`node_modules/drizzle-orm/sqlite-core/db.js`).
- `sql.identifier(name)`, which quotes `name` as a table or column name. Its own doc comment warns that it gives no protection against injection, and whatever it names, the statement reads.
- The D1 binding itself, reached as `getDb().$client` or `getCloudflareEnv().DB`: `prepare(query)` takes SQL text and binds only what `.bind(...)` receives, and `exec(query)` takes SQL text with no binding at all (`worker-configuration.d.ts`).

Inside the `` sql`...` `` tagged template, by contrast, each `${value}` becomes a bound parameter. A table or column object interpolated there renders as its quoted name.

Better Auth issues its own queries through `drizzleAdapter(getDb(), ...)` in `src/lib/auth/better-auth.ts`. Those are the library's code rather than this repository's, and this reference does not cover them.

## Checks

**No request value reaches SQL text.** Run

```sh
git grep -n -e 'sql\.raw' -e 'sql\.identifier' -e 'sql`' -e '\$client' -e '\.prepare(' -e '\.exec(' -- src
```

then `git grep -n 'getDb()' -- src` and read each chain that follows a hit to its end, because a `.run(`, `.all(`, `.get(` or `.values(` on the database object usually sits on the next line. `insert(...).values({...})` is the builder and takes values, and `form.get`, `searchParams.get` and `RegExp.prototype.exec` are not database calls, so those hits are noise. The code is right where every hit is the builder, or a `` sql`...` `` template whose values are interpolated directly. It is wrong where a string built with `+` or a template literal, or returned by a helper that takes a `string`, arrives at `sql.raw`, at one of the four methods, or at `prepare` without `.bind`. On main on 2026-09-30 the first grep returned only the `AVATAR_KEY_PATTERN.exec` call in `src/lib/storage/avatar-validation.ts`, and `getDb()` led to the three builder chains above and to `drizzleAdapter`.

**A template is interpolated once, by the tag.** `` sql`select * from ${users} where ${users.name} = ${name}` `` binds `name`. The same text assembled first as a JavaScript template literal and then handed to `sql.raw` or to `db.all` puts `name` into the source. A reviewer reads the character before the backtick: `sql` means the tag interpolates, anything else means a string was built.

**A name the caller picks comes from a fixed map.** Bound parameters carry values and nothing else: a table, a column, or the direction of `ORDER BY` cannot be one. `asc()` and `desc()` take a column object, so a request string chooses a column through `sql.identifier`, through `sql.raw`, or by indexing the table or `getTableColumns(table)` with the request's text. The code is right where the request's choice is decoded with `Schema.Literals([...])` and looked up in a record from each literal to a column object. It is wrong where the request's text is passed to `sql.identifier`, even though that quotes it, or used as an index into the table's columns without that decode, because the caller then chooses to sort by, or select, any column the table has.

**A value read back from D1 is bound again.** A name stored safely can still be concatenated into a later query, which is the stored form of the same bug. Treat a column value like a request value at every query that reuses it.

**A `LIKE` pattern is handled apart from injection.** `like(column, value)` renders `` sql`${column} like ${value}` `` (`node_modules/drizzle-orm/sql/expressions/conditions.js`), so the value is bound and cannot add SQL, but `%` and `_` inside it still match as wildcards and can widen a search. No `LIKE` query exists in `src/` yet. When one is added and the feature searches `%` and `_` literally, escape them in the value and write the `ESCAPE` clause in a `` sql`...` `` template, because `like()` takes no escape argument. That escaping is a search-semantics fix and replaces none of the binding above.

**The validator leaves quotes alone, and binding does the separating.** `UpdateUserSchema` in `src/shared/entities/user/index.ts` checks the name's type and length and nothing about quotes, which is correct: a validator that refused `'` would reject `O'Reilly` and still leave a raw query open to whatever syntax passes it. Length limits and allow-lists belong to `input-validation.md`; binding is what separates the statement from the value.

**A failed query answers the caller with a fixed message and sends the detail to Workers Logs.** Drizzle wraps every D1 failure in a `DrizzleQueryError` whose message is `Failed query:` followed by the SQL text and the bound parameters (`node_modules/drizzle-orm/errors.js`, thrown from `sqlite-core/session.js`). A write that fails is logged by `orNone` in `src/shared/gateway/user/index.ts` under its event name and answered with `Failed to update profile`. A read that fails becomes a defect through `dieOnPersistenceError`, and `makeRunHandler` in `src/shared/gateway/runtime.ts` logs it under `gateway.handlerDefect` and rejects with `The request could not be completed`, so the server-function handler in `node_modules/@tanstack/start-server-core/dist/esm/server-functions-handler.js`, which sends a thrown `Error`'s `message` to the client, sends that fixed text. On both paths `errorReport` in `src/lib/report-error.ts` writes the SQL text and the driver's error, and leaves the parameters out. A new query path is right where it runs inside a handler `makeRunHandler` built, and wrong where its handler rejects some other way, because the query and its parameters then reach the caller; `information-leakage.md` holds the probe that shows which.

## Reproduce locally

Replay the profile write with names that are SQL syntax, against your own row. Run `bun run db:push:local`, start `PORTLESS=0 bun run dev` (it serves `http://localhost:5173`), sign in on `/login` as the dev user, and in the browser's Network panel copy the request the profile page's Save button sends to `/_serverFn/...`. Send it again with `curl`, keeping the session cookie and the `x-tsr-serverFn: true` header, changing only the `name` form field: `-F "name=O'Reilly"`, then `-F "name=' OR 1=1 --"`. Then read the row with `bunx wrangler d1 execute DB --local --command "select id, name from users"`.

On 2026-09-30 both requests answered 200 with `"status"` `"updated"` in the body, and the row held `' OR 1=1 --` exactly as sent, on the one row the session owns. That is what a bound value looks like. A changed row that is not yours, or a name that differs from what you sent, means the value reached the SQL text. A body whose `error` slot holds a validation message means the validator rejected the name before any query ran, so the step proved nothing about SQL and found a validator that refuses legitimate names. `Failed to update profile` also proves nothing until the `user.updateName` event in the dev server's log says why the write failed. A 500 with `"message":"HTTPError"` in the body answered every call on 2026-09-30 until a page had loaded the `update.fn.ts` module after a dev server restart, and it proves nothing either.

## Fix and pin

Move the query onto the builder, or into a `` sql`...` `` template with the value interpolated by the tag. Where the caller picks a column or a direction, decode the choice with `Schema.Literals` and map it to column objects, so no request text becomes a name.

Pin both sides. A validator test in the shape of `src/shared/gateway/user/update.fn.test.ts` asserts that `O'Reilly` and `' OR 1=1 --` decode unchanged, so a fix that bans quotes fails. For a query that uses `` sql`...` ``, build the same statement on `new QueryBuilder()` from `drizzle-orm/sqlite-core`, which needs no D1 binding, and assert its `.toSQL()` result in one `toStrictEqual`: the text ends in `= ?` and `params` holds the value. Tried on 2026-09-30 with the name `' OR 1=1 --`, the tagged template produced `... where "users"."name" = ?` with the name in `params`, and the same condition through `sql.raw` produced `... where name = '' OR 1=1 --'` with `params` empty, so the assertion fails exactly where the value was spliced into the text.
