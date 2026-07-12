/**
 * Server-side validation for the avatar upload/serve pipeline.
 *
 * The client-supplied MIME type and filename are never trusted: the stored
 * extension is derived from the allow-listed MIME type, and every R2 key is
 * pinned to the `<userId>/avatar.<ext>` shape before any bucket access.
 */

const AVATAR_MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Read-side extension tolerance. The write path always normalizes to the
// canonical lowercase extensions above, but avatar objects written before
// this hardening took the extension straight from the client filename, so
// legacy keys may carry ".jpeg" or uppercase variants. The extension is not
// security-relevant on read — the served Content-Type comes from R2
// httpMetadata and is neutralized by nosniff/CSP — so tolerating those
// variants (case-insensitively) keeps existing avatars serving without
// widening the actual attack surface.
const AVATAR_READ_EXTENSIONS = new Set([
  ...Object.values(AVATAR_MIME_TO_EXTENSION),
  "jpeg",
]);

const AVATAR_KEY_PATTERN = /^[A-Za-z0-9_-]+\/avatar\.([A-Za-z0-9]+)$/;

/**
 * Returns the storage extension for an allow-listed image MIME type, or
 * `null` when the type is not an exact match (parameters, case variants, and
 * non-image types are all rejected).
 */
export const avatarExtensionForMime = (mimeType: string): string | null =>
  // Object.hasOwn: a bare bracket lookup would resolve inherited
  // Object.prototype members ("__proto__", "constructor", …) to truthy
  // values and slip past the allow-list.
  Object.hasOwn(AVATAR_MIME_TO_EXTENSION, mimeType)
    ? AVATAR_MIME_TO_EXTENSION[mimeType]
    : null;

/**
 * Whether a bucket key has the `<userId>/avatar.<ext>` shape with an
 * image extension. The extension check is case-insensitive and also accepts
 * `jpeg` so legacy avatar objects remain readable (see AVATAR_READ_EXTENSIONS).
 */
export const isValidAvatarKey = (key: string): boolean => {
  const match = AVATAR_KEY_PATTERN.exec(key);
  return match !== null && AVATAR_READ_EXTENSIONS.has(match[1].toLowerCase());
};

/**
 * Whether `key` is a well-formed avatar key owned by `userId` — the prefix
 * segment must equal the caller's id. Scopes reads to the caller's own
 * avatar so an authenticated user cannot enumerate others' objects.
 */
export const isOwnAvatarKey = (key: string, userId: string): boolean =>
  isValidAvatarKey(key) && key.startsWith(`${userId}/`);
