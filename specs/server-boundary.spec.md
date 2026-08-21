# Server authorization boundary spec

Target design for the Hono + oRPC boundary that replaces `createServerFn`. Two
callers reach the same procedures: the browser over HTTP through Hono, and an SSR
route loader in-process through oRPC's server-side router client, which does not
pass through Hono.

## Vocabulary

- **Request context**: the incoming `Request` bound to one call — the HTTP request on the browser path, and on the loader path the request the SSR context factory read (the role `getRequest()` fills in `src/lib/auth/session.ts` today). A call either has one or does not.
- **Resolver**: the single session-resolution function both paths call.
- **Identity**: the session user the resolver reports. Identities are never named by callers.
- **Resource**: the stored object a procedure operates on, named in its input (an avatar key, a row id). A procedure either operates on a resource or operates only on the caller's own data.
- **Names**: appears as a field of the parsed input. A procedure with no input names nothing and parses trivially.
- **Authorized pair**: the identity and the resource, if any, that `authorize` bound together for this call.
- **Derived only from**: computed from the authorized pair and nothing else. Field projections of the bound identity (its id, its email) qualify; a caller-supplied string does not.

## What this machine does not verify

It treats the resolver and the context factory as trusted primitives: it checks
the flow around them, not their internals. Three properties therefore sit
outside it, and each is an obligation elsewhere that is **not yet implemented**:

- That neither the resolver nor the context factory memoizes across calls or renders. A memo replay and a fresh derivation are indistinguishable from inside one call. Owed to a lint rule forbidding module-scope mutable state on that path, and to a test asserting two concurrent calls with different sessions get different identities.
- That no module outside the oRPC router reaches a gateway. Such a call never enters this machine. `arch-rules/layer-boundaries` today bans `src/gateways` imports from `src/routes`, `src/entities`, `src/components`, and `src/client`; `src/lib` and the router's own siblings are unrestricted. Owed to a default-deny rewrite of that rule.
- That the caller-visible result of each procedure survives the migration. `updateProfileFn` and `uploadAvatarFn` today return `{ error: "Not authenticated" }` as an ordinary value (`src/server/fn/profile.ts`), which this machine models as `anonymous`; whether the browser then sees a 401 or a 200 carrying an error object is a parity question no state machine can settle. Owed to a test.

## States
- call-started: a call has begun; no request context has been bound.
- http-entry: the call arrived over HTTP and Hono owns the request context.
- local-entry: the call arrived in-process through the SSR context factory.
- identity-derived: the procedure invoked the resolver with this call's request context and bound the identity it reported.
- input-validated: the input parsed, names a resource exactly when the procedure operates on one, and names no identity.
- anonymous: terminal; the resolver completed and reported no identity.
- rejected: terminal; the input did not parse, named the wrong number of resources, or named an identity.
- authorized: the authorized pair is bound.
- denied: terminal; the ownership check completed and reported that the requested resource does not belong to the bound identity.
- executed: terminal; the procedure completed and its result reached the caller.
- failed: terminal; no request context existed, the procedure did not resolve, a resolver or ownership check did not complete, a gateway did not complete or was misrouted, a mutation ran before authorization, or the caller was neither entry path.

## Initial state
call-started

## Actions
| action | from | to | requires | ensures |
|---|---|---|---|---|
| enter-http | call-started | http-entry | the call arrives through the Hono-mounted oRPC handler | this call's request context is the incoming HTTP request |
| enter-local | call-started | local-entry | the call arrives from an SSR loader through the oRPC server-side context factory | this call's request context is the request that factory read |
| reject-foreign-caller | call-started | failed | the caller reaches a procedure by neither entry path above | no resolver, ownership, or gateway call occurs |
| fail-context | http-entry, local-entry | failed | this call has no request context | the resolver is not invoked |
| resolve-identity | http-entry, local-entry | identity-derived | this call has a request context, the procedure invokes the resolver with it, and the resolver completes and reports an identity | that identity is bound to this call |
| reject-anonymous | http-entry, local-entry | anonymous | this call has a request context, the procedure invokes the resolver with it, and the resolver completes without error and reports no identity | the procedure body never runs |
| fail-resolve | http-entry, local-entry | failed | the procedure invokes the resolver and the resolver does not complete, or completes without determining whether a session exists | the error propagates |
| resolve-outside-procedure | http-entry, local-entry | failed | this call has a request context and the procedure does not invoke the resolver | no ownership or gateway call occurs |
| validate-input | identity-derived | input-validated | the input parses against the procedure's schema, names a resource exactly when the procedure operates on one, and names no identity | the named resource, if any, becomes this call's requested resource |
| reject-input | identity-derived | rejected | the input does not parse, names no resource for a procedure that operates on one, names more than one, or names an identity | no ownership or gateway call occurs |
| authorize | input-validated | authorized | this call has no requested resource, or the ownership check completes and reports that the requested resource belongs to the bound identity | the bound identity and the requested resource, if any, become this call's authorized pair |
| deny | input-validated | denied | the ownership check completes and reports that the requested resource does not belong to the bound identity | no gateway call occurs |
| fail-authorize | input-validated | failed | the ownership check does not complete | the error propagates |
| mutate-early | input-validated | failed | a state-mutating gateway is invoked before authorization completes | no result reaches the caller |
| invoke-gateway | authorized | executed | at least one gateway was invoked, every gateway this call invoked received arguments derived only from this call's authorized pair, all of them completed, and the procedure completed | the caller receives the procedure's result |
| complete-without-gateway | authorized | executed | the procedure completed without invoking any gateway | the caller receives the procedure's result |
| misroute-gateway | authorized | failed | some gateway this call invoked received an argument not derived only from this call's authorized pair | no result reaches the caller |
| fail-gateway | authorized | failed | every gateway invocation received arguments derived only from the authorized pair, and one of them does not complete | the error propagates |

## Invariants
- Identity is never read from procedure input, HTTP body, query string, or any caller-supplied argument.
- Both entry paths derive identity by invoking one resolver, from inside the procedure, with that call's request context. A procedure that does not invoke it reaches `failed`.
- Every argument any gateway receives in a call is derived only from that call's authorized pair.
- The ownership check is the only gateway work permitted before `authorized`; no state-mutating gateway runs before it.
- Gateways receive identifiers as arguments and resolve no session.
- The resolver never reports "no identity" for a failure to determine whether a session exists.

## Forbidden flows
- `local-entry` reaches `executed` without passing `identity-derived`, `input-validated`, and `authorized`.
- `http-entry` reaches `executed` without passing `identity-derived`, `input-validated`, and `authorized`.
- `authorized` is reached with an identity taken from input.
- `anonymous`, `rejected`, `denied`, or `failed` reaches `executed`.
- A resolver, ownership-check, or gateway that does not complete is reported as `anonymous`, `rejected`, `denied`, or `authorized`.
- For the same session, the same input, and the same outcome at every step whose guard depends on the environment, the two entry paths reach different terminal states.
- A call with no request context reaches `anonymous`.
- A gateway that does not complete, or that received an argument not derived from the authorized pair, reaches `executed`.

## Requirements
- R1: For the same session, the same input, and the same outcome at every environment-dependent step, both entry paths reach the same terminal state.
- R2: An implementation that resolves the session outside the procedure reaches `failed` on both entry paths.
- R3: A caller supplying another user's identity or resource reaches `rejected` or `denied`, never `executed`.
- R4: A caller with a request context and no session reaches `anonymous` on both entry paths.
- R5: A resolver, ownership check, or gateway that does not complete reaches `failed`, which is a different state from `anonymous`, `rejected`, and `denied`.
- R6: A caller that is neither entry path reaches `failed`.
