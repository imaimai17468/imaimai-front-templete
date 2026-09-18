/**
 * The security headers the root route puts on every HTML document.
 *
 * The document is where these matter: it is the response a third-party page
 * can frame, the one that carries the signed-in user's name and address in its
 * markup and in the dehydrated query cache, and the one a shared cache is most
 * likely to consider storable. The framework sets none of them, and it merges
 * a route's headers over its own `Content-Type`.
 *
 * `/api/avatars` builds its own `Response` and is not a rendered match, so its
 * stricter `Content-Security-Policy` and its `immutable` `Cache-Control` are
 * untouched by this.
 */
export const DOCUMENT_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} satisfies Record<string, string>;
