# Attack Classes

#### Attack classes — choose and split based on Phase 1

Select attack classes relevant to the application type. Not every class applies to every codebase. The list below is a starting point; add application-specific classes from Phase 1 and split large codebases per subsystem. Frame work as finding, validating, fixing, and prioritizing vulnerabilities. Keep validation to source review and bounded local fixtures; do not develop payload chains, test availability on live services, or take action in shared environments.

Use `confirmed` only when source evidence and bounded validation establish the full boundary and meaningful result. Use `needs_validation` when a specific deployment, provider, platform, identity, or runtime fact is unavailable; state the missing fact and the safe owner-observed or local check that resolves it.

`webapp-security-review` holds one reference per vulnerability class with the checks that class takes in this repository, under `.claude/skills/webapp-security-review/references/`. A block below keeps only what that reference does not already say, and the hunter prompt carries both, as `HUNTING.md` requires.

> **AI / LLM / agent targets** (chatbots, RAG, persistent memory, tool-calling agents, MCP servers/clients, prompt assembly, or model-controlled actions): use the context, memory-poisoning, action-binding, tool-schema, MCP-identity, and output classes in [AI-AND-LLM.md](AI-AND-LLM.md).
>
> **HTTP cache and identity targets** (edge or Cache API caching, JWT, OAuth/OIDC, SAML, MFA, passkeys, account recovery/linking, API keys, or mTLS): use [WEB-PROTOCOL-AND-AUTH.md](WEB-PROTOCOL-AND-AUTH.md).
>
> **Client-side and browser targets** (DOM clobbering, service workers, cross-tab state, WebSockets, cross-site leaks, or window relationships): use [CLIENT-SIDE.md](CLIENT-SIDE.md).
>
> **Supply-chain and release targets** (generated inputs, CI caches and expressions, or a deploy pipeline): use [SUPPLY-CHAIN-AND-RELEASE.md](SUPPLY-CHAIN-AND-RELEASE.md).
>
> **Protocol, RPC, and messaging targets** (webhooks, Cloudflare Queues, Durable Objects, Workers RPC over a service binding, WebSocket messages, GraphQL, or event buses): use [PROTOCOLS-RPC-AND-MESSAGING.md](PROTOCOLS-RPC-AND-MESSAGING.md).
>
> **Resource-exhaustion and availability targets** (untrusted work can consume shared CPU, memory, D1 or R2 capacity, connections, queues, quotas, or operator-owned spend): use [RESOURCE-EXHAUSTION-AND-AVAILABILITY.md](RESOURCE-EXHAUSTION-AND-AVAILABILITY.md).
>
> **Data-isolation and lifecycle targets** (multi-tenant stores, caches/search, object links, analytics, export/backup, migration, deletion, retention, or restore): use [DATA-ISOLATION-AND-LIFECYCLE.md](DATA-ISOLATION-AND-LIFECYCLE.md).

**Injection** (subagent_type: `general`)
Trace untrusted input from entry point to dangerous sink. Each sink this stack has is covered by a reference: SQL through Drizzle and D1 (`sql-injection.md`), HTML and URL attributes (`xss.md`), redirects and client-built requests (`client-side.md`), R2 keys (`path-traversal.md`), decoders and serialization adapters (`data-processing.md`), and log records (`logging.md`).

Do not stop at the obvious direct paths. Look for indirect injection: data stored safely, then retrieved and used in a dangerous context by different code. Look for injection through field names, keys, headers, and metadata — not just values. Look for injection into secondary systems (logs, caches, search indexes, analytics).

**Access control** (subagent_type: `general`)
Verify that a caller cannot do something outside its authority, with the checks in `access-control.md` and `api.md`. Beyond them, check that bulk, batch, export, and import operations authorize each item.

For complex access models, split into separate agents for auth bypass vs authorization logic.

**Resource and file handling** (subagent_type: `general`)
Path traversal, SSRF, uploads, and deserialization are covered by `path-traversal.md`, `ssrf.md`, `file-upload.md`, and `data-processing.md`. Beyond them, look for a race between the check on an object and its use (TOCTOU), such as an R2 key checked by one request and replaced by another before the first writes it.

**Cryptography and secrets** (subagent_type: `general`)
- Weak randomness for security-critical values (tokens, keys, nonces)
- Hardcoded secrets, secrets in logs, error messages, URLs, or client-visible responses
- Broken key derivation, missing HMAC verification, nonce reuse
- Timing side-channels on secret comparison
- Misuse of crypto primitives (ECB mode, unauthenticated encryption, static IVs, etc.)
- What happens when crypto operations fail? Does the error path fall back to no-crypto?

**Business logic** (subagent_type: `general`)
Hunt logic errors by hand: standard scanners cannot find them, and they yield high-impact findings. `business-logic.md` covers invariants, check-then-act races, partial failure, replay, values the server can derive, and rate limits versus business counts. Beyond it, for each major workflow:
- **Numeric/quantity manipulation**: Negative values, zero values, overflow, precision loss, type coercion between string and number.
- **Time-based logic**: Expiry checks, scheduling, rate windows, clock skew. What happens at exact boundary moments? What about timezone differences between components?
- **Implicit trust assumptions**: Data from storage, config, other components, or plugins assumed safe because "we validated it on the way in." What if a different code path wrote it?

**Feature abuse and data leakage** (subagent_type: `general`)
Legitimate features used for unintended purposes. Look for bugs in the design, not only in the code:
- **Export/backup as exfiltration**: Can a low-privilege user trigger an export, snapshot, or backup that includes data above their access level? Can they export other users' data? Does the export include deleted/draft/private content? Revision history that was supposed to be pruned?
- **Import/restore as injection**: Can import overwrite existing data? Can it create records that bypass normal validation? Can it inject content into collections the user has no write access to? Does it respect the same permission model as the UI?
- **Search/filter/sort as oracle**: Can search queries reveal whether content exists that the user cannot directly access? Do filter parameters let users probe statuses, roles, or fields they should not know about? Does sorting by a hidden field reveal its values through result ordering?
- **Preview/draft/staging leakage**: Are preview tokens scoped to one item or do they unlock broader access? Can draft content be discovered through search, RSS feeds, sitemaps, or API listing endpoints? Can cache headers cause a CDN to serve private content publicly?
- **Enumeration and webhook URLs**: `information-leakage.md` covers what a response reveals by existing, and `ssrf.md` covers a URL the server fetches.

**Chained vulnerabilities and trust boundaries** (subagent_type: `general`)
Individually allowed or contained behavior can become a vulnerability when another component or lifecycle step relies on a stronger guarantee:
- **Multi-step boundary failures**: Map what a low-privilege principal may read, write, invoke, and retain, then connect only concrete outputs to later trust decisions. Confirm each prerequisite and do not assume a downstream effect.
- **Cross-component trust gaps**: Component A validates input and passes it to component B. Compare the exact guarantee A produces with what B assumes, including truncation, type coercion, normalization, tenant scope, and plugin/extension access.
- **Second-order use**: Data safe when stored may become dangerous in a later context. A field name becomes a JSON path, a slug becomes a file path, escaped text enters raw rendering, or a stored string becomes a URL, regex, template, or policy expression.
- **Scope and capability growth**: Token, API-key, plugin, OAuth, MCP, or AI capabilities become broader after delegation, refresh, caching, role change, or composition. Name the concrete operation the resulting principal should not have.
- **Timing and ordering**: Review setup, migration, soft-delete, revoke/cache expiry, check/use, and validate/consume windows. Confirm stale state is accepted before reporting.
- **Rollback and recovery**: Undelete, restore, revision rollback, and cancellation must apply current ownership, validation, and authorization. Confirm which invalid state is restored.

**Wildcard** (subagent_type: `general`)
You are not given a category. Find vulnerabilities outside the standard classes already assigned.

Read code that looks boring or disconnected from security. Follow incomplete, experimental, compatibility, and fallback features, but retain the same concrete boundary and validation requirements as every other class.

Use these starting points, but do not limit yourself to them:
- What is the strangest code in the codebase? Why does it exist? What happens if it is abused?
- Are there any features that feel half-finished, experimental, or bolted on? Those have the weakest security because they got the least review.
- What happens if you use the API in a way the frontend never would? The UI constrains users, but the API does not. What API calls are possible but never made by the client?
- Are there any hidden or undocumented endpoints, parameters, headers, or features? Look at route registrations, middleware, and config for things that are not in the docs.
- What happens when you mix features that were not designed to work together? Localization + preview + caching. Import + plugins + webhooks. OAuth + impersonation + API keys.
- Is there anything interesting in the git history? Reverted security fixes, commented-out auth checks, secrets that were committed then removed (still in history).
- Which valid-account actions affect other users, shared integrity, availability, or operator-owned cost? Verify containment, quotas, authorization, and recovery around those actions.
- Which operations are irreversible or require elevated confirmation? Bind authorization and approval to the final principal, action, and resource.
- What assumptions does the code make about the environment? That the database is local, that the clock is accurate, that DNS is trustworthy, that the filesystem is case-sensitive?
- Look at the test files — what are they **not** testing? Compare the edge cases the developer thought about (tests exist) with the ones they did not (no tests).

Pursue anomalies inside your assigned scope until the invariant is settled. If something looks strange, read it until you can state whether it is safe. If a function has a comment explaining why it is safe, verify the explanation. If a variable is named `temp` or `hack` or `legacy`, read it closely.

**Obvious things** (subagent_type: `general`)
Other agents hunt subtle bugs. This agent checks the basic exposures that are easy to overlook because everyone assumes someone else already checked them. Run every check in `supply-chain.md`, `deployment.md`, `cors.md`, `session.md`, `browser-headers.md`, and `information-leakage.md`, which cover env files and secrets in the history, dependency pins and advisories, development settings in production, CORS, cookie attributes, TLS, and error responses. Then check:
- Are there any hardcoded passwords, API keys, tokens, or secrets in the source? (grep for `password`, `secret`, `apikey`, `token`, `Bearer`, `-----BEGIN`, common default passwords)
- Are there any TODO/FIXME/HACK/XXX comments that reference security? (`TODO: add auth`, `FIXME: validate input`, `HACK: skip permission check`)
- Are there test/example/seed credentials that work in production?
- Is there a `/debug`, `/admin`, `/test`, `/status`, `/health`, `/metrics`, or `/config` endpoint that is unprotected?
- Are there any `eval()`, `Function()`, or `import()` calls with dynamic input?
- Are there any open redirects? (parameters named `redirect`, `return`, `next`, `url`, `goto`, `continue` that feed into redirects without validation; `client-side.md` holds the check)

This agent does not need to be creative. It needs to be thorough and literal. Check every item. Report each result.

**Important**: For any finding this agent reports, it must verify the full code path, not just surface appearance. If a cookie is missing `HttpOnly`, check whether the cookie contains security-sensitive data and whether JS needs to read it by design. If an error message contains a field name, check whether the field is ever actually populated with sensitive data. A flag is not a finding — trace the impact before reporting.
