# Authenticated avatar read spec

## States
- request-received: GET `/api/avatars` has started and no identity has been resolved.
- unauthenticated: terminal response for a request without a session user.
- authenticated: the server authorization boundary has derived the user id from the session.
- rejected: terminal response for a missing, malformed, or foreign avatar key.
- loading: the gateway is reading the caller-owned key from R2.
- not-found: terminal response when R2 has no object for the key.
- failed: terminal framework error response when session resolution or R2 access throws.
- served: terminal response containing the avatar stream and hardened response headers.

## Initial state
request-received

## Actions
| action | from | to | requires | ensures |
|---|---|---|---|---|
| fail-session | request-received | failed | session resolution in `src/server/handlers/**` throws | the error propagates as a framework 5xx; no key validation or R2 read occurs |
| reject-anonymous | request-received | unauthenticated | session resolution in `src/server/handlers/**` succeeds without a user | returns JSON `{"error":"Unauthorized"}` with 401; no key validation or R2 read occurs |
| accept-session | request-received | authenticated | session resolution in `src/server/handlers/**` succeeds with a user | captures that server-derived user id once in request-local state |
| reject-key | authenticated | rejected | key is missing, malformed, or not owned by the captured user id | returns JSON `{"error":"Invalid key"}` with 400; no R2 read occurs |
| load-avatar | authenticated | loading | key is well formed and owned by the captured user id | `src/server/handlers/**` passes the key to a gateway once; only the gateway initiates the R2 read |
| fail-avatar | loading | failed | the gateway throws | the error propagates as a framework 5xx and is not converted to 404 |
| report-missing | loading | not-found | gateway returns no object | returns JSON `{"error":"Not found"}` with 404 |
| serve-avatar | loading | served | gateway returns an object | streams the object with its stored content type, falling back to `image/png` when metadata is absent |

## Invariants
- R2 is never read before a session user and ownership-valid key have both been established.
- The authenticated user id is captured once per request, is not shared across requests, and never comes from caller-supplied input.
- Routes do not resolve sessions or access persistence directly; they delegate to `src/server/handlers/**`.
- Only gateways initiate persistence reads.
- A served response includes `Content-Type` from stored metadata or the `image/png` fallback, `Cache-Control: private, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'none'`.

## Forbidden flows
- `request-received` reaches `loading` or `served` without `accept-session`.
- `authenticated` reaches `loading` with a missing, malformed, or foreign key.
- `unauthenticated`, `rejected`, `not-found`, or `failed` reaches `served`.
- A session or gateway exception is converted to 400 or 404.
- A response eligible for shared caching is returned from `served`.

## Requirements
- R1: An anonymous request receives 401.
- R2: A missing, malformed, or foreign key receives 400.
- R3: A valid caller-owned key with no R2 object receives 404.
- R4: A valid caller-owned key with an R2 object receives the object stream and hardened headers.
- R5: Session and gateway exceptions keep the framework's 5xx behavior.
- R6: The observable status codes, JSON error bodies, content type fallback, and hardened success headers remain unchanged by the layer refactor.
