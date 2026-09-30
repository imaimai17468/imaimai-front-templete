# Server-side request forgery

Draws on chapter 15 (Server-Side Request Forgery).

Server-side request forgery is a request that decides where the server sends a request of its own. The second request leaves from the Worker rather than from the user's browser, so it can reach hosts that trust the Worker, carry credentials the Worker holds, and return what it read to the caller. The browser's same-origin rules do not apply to it. The defect is that an untrusted value chooses the destination, or the method, headers or body, of an outbound request, whichever URL filter sits in front of it.

## Where the decision lives here

Nothing under `src/` makes an outbound request today. `git grep -n 'fetch(' -- src` finds only `src/ssr.tsx`, which is the Worker's inbound handler, and no `HttpClient` from Effect is imported.

The Worker still makes outbound requests through Better Auth's Google provider (`@better-auth/core`, `dist/social-providers/google.mjs`, as installed with `better-auth` 1.7.2): the token exchange with `https://oauth2.googleapis.com/token` and the signing keys from `https://www.googleapis.com/oauth2/v3/certs`. Both URLs are constants in the library, and the profile, `picture` included, is decoded from the ID token rather than fetched, so no request value picks a destination there.

The `image` column is where a stored URL exists. Better Auth writes Google's `picture` into it at sign-up, and `CurrentUserReader` (`src/shared/gateway/user/read.ts`) sends it on as the avatar URL only when `httpsUrl` (`src/lib/https-url.ts`) parses it as an absolute `https:` URL. The browser fetches that URL through an `<img>`, so it is not a server-side request. It becomes one the moment a route fetches, proxies or resizes it on the server, and `httpsUrl` would not stop that: it checks the scheme and nothing about the host.

What Cloudflare documents about a Worker's own `fetch` (read 2026-09-30):

- A subrequest goes to a URL, never to an IP address directly (Known issues), so `http://169.254.169.254/` or `http://10.0.0.1/` is not a destination a Worker can name. A hostname that resolves to such an address is a separate question this page does not answer, and it is not confirmed here.
- A new `Request` follows redirects by default (`redirect: "follow"`, Request page), so a destination checked before the call is not the one the response comes from unless `redirect` is set to `manual` or `error`.
- `cf.resolveOverride` redirects the DNS lookup only when both hosts are in your zone (Request page).
- A plain `fetch` to another Worker on the same zone fails, and a service binding is the documented route (Limits page).

The book's other targets, a VM's metadata service and a container network's internal services, have no counterpart a Worker reaches by those rules. Anything the account exposes to Workers on purpose (a service binding, a Tunnel, a private origin) is in scope once it exists, because an SSRF reaches what the Worker is allowed to reach.

## Checks

**List the outbound requests before judging any of them.** Run `git grep -n -e 'fetch(' -e 'new Request(' -e 'HttpClient' -- src`, and check `wrangler.toml` for service bindings. Today the answer is the inbound handler and requests a test builds as input. A new hit is a sink, and each value that flows into its URL, method, headers or body is a source, including a column, a queue message or a field of an uploaded document.

**The request picks a destination id, and the server holds the URL.** Where the set of destinations is known (a webhook to a partner, a preview of this app's own pages), the request sends a logical id, and a map on the server turns it into the whole URL. An unknown id is refused before any network call. It is wrong where the request, or a row it wrote, carries the URL, even if the URL passes a parser: parsing a URL says what its parts are, never that the host is one this feature may call.

**Where any URL must be allowed, one policy covers every part of it.** The scheme is `https:` only, user info and fragments are refused, the host is compared whole against an allow-list rather than by substring, the port is fixed, and the policy runs again for each redirect hop, which in practice means `redirect: "manual"` and a hop limit. A host checked by name can still resolve to an address the check never saw, and the Cloudflare pages read here document no way for a Worker to fix the address it connects to, so state that limit in the PR rather than implying the check covers it.

**The response goes back to the caller only as far as the feature needs.** A webhook test answers delivered or not delivered. Returning the upstream body, its headers or a detailed connection error turns the Worker into a reader for whatever it can reach, and a blind variant, one that returns nothing, still sends the request.

**Inbound credentials never ride an outbound request.** Build the outbound `Headers` from scratch. Passing `request.headers` along, or constructing the new request from the inbound one, forwards the session cookie and any `Authorization` to the destination. A secret from `CloudflareEnv` goes only to the destination it was issued for.

**Bound the time and the size.** A slow or huge response holds the Worker's request open. Pass an `AbortSignal` that fires after a fixed time and stop reading the body at a byte count, because `Content-Length` can be missing or wrong.

## Reproduce locally

No route here fetches a URL, so the step that runs today is the grep in the first check: `src/ssr.tsx` and the two `Request`s in `src/routes/api/-avatars.test.ts` are the expected answer, and any other hit is a sink to review. For a feature that adds a fetch, the first reproduction is the fake-service test under Fix and pin, sending the refused and the allowed id. As a second, optional step, run a receiver you control that records every request and answers a fixed marker, such as `bun -e 'Bun.serve({ port: 8788, fetch(r) { console.log(r.method, r.url, [...r.headers]); return new Response("LAB_MARKER"); } })'`, then send the feature's request once with the id or URL it expects and once pointing at `http://localhost:8788/`.

- The marker in the Worker's response means the request chose the destination and the body came back.
- A line in the receiver's log with no marker in the response is the blind case, which is still the finding.
- A `cookie` or `authorization` pair in the logged headers means inbound credentials were forwarded.
- The feature's refusal and no line in the receiver's log is the pass.
- A timeout proves nothing by itself: under `bun run dev` the Worker runs in workerd on your machine, and whether it reaches `localhost` there is not what Cloudflare's network allows in production. This has not been tried in this repository. Judge the code and the receiver's log, never the timeout.

Point the receiver at nothing outside your own machine.

## Fix and pin

Map a destination id to a URL on the server, set `redirect: "manual"`, build the headers fresh, and return only the outcome. Put the outbound call behind a `Context.Service` in the feature's `gateway/`, the way `AvatarBucket` wraps the R2 binding, so a test provides a fake and asserts the calls it received. Pin one row per case in a single `toStrictEqual` of the result and the fake's calls: an unknown id answers the refusal with no call recorded, a known id records exactly one call to the mapped URL without the inbound cookie, and a redirect response is not followed.
