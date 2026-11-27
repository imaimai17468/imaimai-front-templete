/** The routes the smoke run requests, and what each answer must hold. */

import type { Route } from "./smoke.ts";

/**
 * What the root route's `headers()` has to put on a rendered document.
 *
 * Written out here rather than imported from `src/`, so a change to the
 * application's record has to be made on this side too and cannot drop a
 * header silently.
 */
// fallow-ignore-next-line code-duplication
export const EXPECTED_DOCUMENT_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} satisfies Record<string, string>;

export const ROUTES: readonly Route[] = [
  {
    headers: EXPECTED_DOCUMENT_HEADERS,
    location: null,
    marker: "docs/FORKING.md",
    path: "/",
    status: 200,
  },
  {
    headers: EXPECTED_DOCUMENT_HEADERS,
    location: null,
    marker: "Sign in With Google",
    path: "/login",
    status: 200,
  },
  {
    headers: EXPECTED_DOCUMENT_HEADERS,
    location: null,
    marker: "Sign-in failed",
    path: "/login?error=access_denied",
    status: 200,
  },
  // A build that stops copying `public/` answers 404 here while every
  // rendered route still passes.
  {
    headers: {},
    location: null,
    marker: null,
    path: "/favicon.svg",
    status: 200,
  },
  // Signed out, so the profile route's guard answers with its redirect rather
  // than a page. Nothing else here runs that guard. The framework returns that
  // redirect before it collects the route's headers, so this row names none.
  {
    headers: {},
    location: "/login",
    marker: null,
    path: "/profile",
    status: 307,
  },
  // The Worker's entry hands this path to the avatar gateway in place of
  // Start's handler, so a request that skipped the entry would answer the
  // router's 404 page. Signed out, the gateway answers its JSON 401 before
  // reading a key.
  {
    headers: { "Content-Type": "application/json" },
    location: null,
    marker: null,
    path: "/api/avatars",
    status: 401,
  },
];
