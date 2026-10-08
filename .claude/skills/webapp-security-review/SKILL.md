---
name: webapp-security-review
description: Stack-specific web application security checks for this repository (TanStack Start on Cloudflare Workers, Better Auth, D1 through Drizzle, R2, the `gateway/` authorization boundary), one reference per vulnerability class, each saying which file to open, what to grep, which request to send, and what test pins the fix. Use when implementing or reviewing a server function, an API route, a gateway, an upload, a header, or anything that reads the session, alongside `web-security-audit`, which owns the general audit methodology and reporting.
---

# Web application security review

This skill turns a vulnerability class into the checks it takes in this repository. `web-security-audit` decides how an audit is run and how a finding is validated and reported; this skill supplies what to look at once the class is known.

## Procedure

1. **Write the policy before reading the code.** For the feature under review, list who can do what to which object: the caller (signed out, the owner, another user), the object, the action, and the decision. Without the table, a 200 and a 403 are equally plausible answers, and a review has nothing to compare against.
2. **List every entrance to the same data.** A `createServerFn` in a `*.fn.ts` under `src/` and a `server.handlers` entry in a file route under `src/routes/api/` each reach the data by a different path, and a policy holds only where every one of them applies it. An object in R2 is a third path wherever the bucket has been given a public URL; without one it is served only through a route. `git grep -n -e 'createServerFn(' -e 'handlers:' -- src` lists the first two.
3. **Change one thing in a request that works, and compare the answer with the table.** Send the request as the owner first, then swap one element (the caller, or one id), so a difference in the answer has one cause.
4. **Fix at the boundary the reference names**, which for anything the session decides is the service in the `gateway/` directory rather than the route or the component.
5. **Pin the decision with a test of each row of the table**, the allowed rows as well as the denied ones, so a fix that denies everyone fails as loudly as the hole it closed.

Run step 3 only against the local dev server and accounts you created yourself. Changing an id against a service you have not been authorized to test is an attack whatever the intent.

`bun run dev` applies the D1 migrations itself when it starts, and keeps the local D1 as SQLite files under `.alchemy/local/d1/cloudflare-runtime-D1DatabaseObject/`: one `<hash>.sqlite` per local D1 Alchemy has created, beside `metadata.sqlite`. Deleting `.alchemy/state` leaves the earlier file behind, and nothing in a file's name says which stage it belongs to, so the dev stage's file is the one holding the user you signed in as, the most recently modified one after you sign in. A reference that reads a row runs `sqlite3 -readonly <that file> "<SQL>"`. Whether a write made with `sqlite3` reaches a running `bun run dev` has not been verified, so a reference that writes a row stops `bun run dev` first and starts it again after.

## References

Each file in `references/` covers one vulnerability class and is named for it, such as `references/access-control.md`. List the directory and open the file for the class under review; open more than one where a change crosses classes, as an upload does for both file handling and authorization.

Each reference is written in this repository's terms and states what a reviewer does and what they then see. Its source is the book below, summarized in our own words for this stack. The book is not quoted, because its text carries no license that permits republishing it in a public repository.

> 「Webアプリケーションセキュリティ入門」 yousukezan + AI, https://bogus.jp/webapp_security_review.pdf

Chapters the references leave out, and why:

| Chapters | Reason |
| --- | --- |
| 1 to 3 | HTTP basics, the book's Flask sample app, and Burp Suite setup, none of which is a check on this code |
| 13 (OS command injection) | A Worker has no shell to inject into |
| 14 (server-side template injection) | Rendering is React, which has no template source a request can supply |
| 26 to 29 | Running an assessment, writing the report, rebuilding the sample app, and future topics, which `web-security-audit` covers or which name no check |

## Adding a reference

Name the file for the vulnerability class in kebab-case and open it with the chapters it draws on. Write each check as the file to open or the command to run, followed by what a reviewer sees when the code is right and when it is not. A reproduction replays a request against an object that exists, and says what each possible answer means, including the one that proves nothing, such as a 404 for an id nothing wrote. Open every file a check names before writing the check. Write in your own words, and never copy a sentence, a table, or a code sample from the book.
