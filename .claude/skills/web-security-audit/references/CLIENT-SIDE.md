# Client-Side and Browser Hunting

#### When to use this file

Reach for this file when meaningful trust decisions or untrusted rendering happen in the browser beyond what `webapp-security-review` covers: DOM clobbering, WebSockets, service workers, offline caches, cross-tab state, cross-site leaks, and window relationships. These paths include sources the server never sees, such as URL fragments, `window.name`, and previously cached content.

Use alongside `ATTACK-CLASSES.md`. DOM XSS, prototype pollution, `postMessage`, CORS, browser storage, clickjacking, and client-side redirects are covered by `webapp-security-review`'s `xss.md`, `client-side.md`, `cors.md`, and `browser-headers.md`, and CSRF and sessions by its `csrf.md` and `session.md`.

## Core discipline (include in every agent prompt for this domain)

```
- A client-side candidate needs a controllable source and an executing or disclosing sink. Name both and show attacker-influenced data reaching the sink.
- The impact must reach a victim's session, another origin, or shared persistence. Self-injection and disclosure of the attacker's own data are not findings.
- Framework escaping, browser same-origin policy, CSP, COOP/CORP, service-worker scope, and modern noopener defaults are real controls. Verify them before assigning impact.
- Browser storage and caches are shared by origin and may outlive login state. Identify who writes, who reads, and which account, tenant, or worker lifecycle clears each record.
- Use `confirmed` only for complete source evidence plus bounded local browser tests. Use `needs_validation` when renderer, deployed header, or browser-policy behavior is required but unavailable.
```

## DOM and object-state attack classes (subagent_type: `general`)

**DOM clobbering**
Attacker-injected `id` or `name` attributes shadow a global, form property, configuration object, or initialization flag later trusted by code. Require both a markup path that preserves the attribute and a security-relevant use of the clobbered value.

## Cross-origin network attack classes (subagent_type: `general`)

**Cross-site WebSocket request use**
A WebSocket upgrade accepts ambient cookies from an untrusted origin without an `Origin` check or channel-specific token, allowing the victim's session to read or mutate data. Confirm both the upgrade behavior and a security-relevant message handler.

## Service-worker and browser-storage attack classes (subagent_type: `general`)

**Service-worker registration and scope takeover**
Attacker-influenceable content can become the registered worker script, control a path that receives an over-broad `Service-Worker-Allowed` scope, or alter update imports without integrity control. Verify the final script URL, response MIME type, origin, scope, and who controls every imported script. A normal same-origin worker with intended scope is not a defect.

**Service-worker cache and identity confusion**
The worker caches personalized responses without including account, tenant, authorization state, or request mode in its policy, then serves them after account switch or logout. Review fetch-event routing, cache names and keys, navigation fallbacks, cache cleanup, and whether error/offline paths return another user's prior response.

**Cross-context storage and broadcast confusion**
`storage` events, `BroadcastChannel`, shared workers, or origin-wide caches carry identity or commands between tabs without binding them to the current session. Check account switching, private/public windows, tenant changes, and stale tabs that can overwrite newer auth state.

## Cross-site information leak classes (subagent_type: `general`)

**XS-Leaks and cross-origin state oracles**
An attacker page can distinguish protected cross-origin state through resource load/error events, frame or window state, redirect behavior, timing, cache state, or response size while the browser attaches victim credentials. Require one concrete secret-bearing predicate such as whether a private object, role, or account exists. Generic timing variance or public-resource availability is not a finding.

**Window and opener state disclosure**
A cross-origin window's permitted metadata or navigation result reveals protected state, or a retained opener/named-window relationship lets an attacker-controlled page influence a privileged navigation. Check COOP, frame protections, `noopener`, exact origin, and whether the observable state is confidential.

## Universal moves (apply across the above)

- Start from DOM, worker, message, and storage sinks, then trace backward to browser-only and server-controlled sources. Record the browser policy that should stop the path.
- Test account switch, logout, worker update, offline fallback, and stale-tab state with a local test origin and dummy accounts. Do not use production users, origins, or shared services.
- For XS-Leaks, list only predicates proved by source and local browser behavior. Then identify the response headers or rendering choice that would remove the oracle.

## Validation rules (apply before reporting ANY finding here)

1. Cite the source, sink, browser policy, affected origin/session, and observable mutation or disclosure.
2. For DOM clobbering, prove the markup survives and the shadowed value is used.
3. For service workers and storage, prove lifecycle reachability: an attacker-controlled write or cache entry must reach a different account, tenant, or later authorization state.
4. For WebSocket, cross-context messaging, and XS-Leaks, show exact origin/source validation and the protected state or action exposed. Confirm that CSP, COOP/CORP, cookies, and SameSite policy do not already block it.
5. Return `confirmed` findings only with a complete client path and bounded local evidence. Return `needs_validation` with the precise deployed header, browser version, or renderer behavior an owner must verify.
