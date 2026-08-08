/**
 * Server-side validation for the avatar upload/serve pipeline.
 *
 * The client-supplied MIME type and filename are never trusted: the stored
 * extension is derived from the allow-listed MIME type, and every R2 key is
 * pinned to the `<userId>/avatar.<ext>` shape before any bucket access.
 */

const AVATAR_MIME_TO_EXTENSION = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

// Read-side extension tolerance. The write path always normalizes to the
// canonical lowercase extensions above, but avatar objects written before
// this hardening took the extension straight from the client filename, so
// legacy keys may carry ".jpeg" or uppercase variants. The extension is not
// security-relevant on read — the served Content-Type comes from R2
// httpMetadata and is neutralized by nosniff/CSP — so tolerating those
// variants (case-insensitively) keeps existing avatars serving without
// widening the actual attack surface.
const AVATAR_READ_EXTENSIONS = new Set([
  ...AVATAR_MIME_TO_EXTENSION.values(),
  "jpeg",
]);

const AVATAR_KEY_PATTERN = /^[A-Za-z0-9_-]+\/avatar\.([A-Za-z0-9]+)$/;

/**
 * Returns the storage extension for an allow-listed image MIME type, or
 * `null` when the type is not an exact match (parameters, case variants, and
 * non-image types are all rejected).
 */
export const avatarExtensionForMime = (mimeType: string): string | null =>
  // Map.get consults own entries only — Object.prototype members
  // ("__proto__", "constructor", …) can never satisfy the allow-list.
  AVATAR_MIME_TO_EXTENSION.get(mimeType) ?? null;

/**
 * Upload size ceiling in bytes. Exported so the client-side pre-check and the
 * server-side validator read the same number — a duplicated literal is how the
 * two limits drift apart.
 */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Why an upload's byte length is unacceptable, if it is. Not exported until a
// caller needs to name it — consumers switch on the literals, and knip treats an
// unconsumed export as dead surface.
type AvatarSizeRejection = "empty" | "too-large";

/**
 * Classifies an upload's byte length, returning `null` when the size is
 * acceptable. A rejection *reason* rather than a boolean so callers can keep
 * distinct messages ("no file selected" vs "too large") and so a future limit
 * (per-plan ceilings, minimum dimensions) can extend the union.
 *
 * The server is the enforcing caller; the client pre-check only spares the user
 * a doomed upload.
 */
export const avatarSizeRejection = (
  size: number
): AvatarSizeRejection | null => {
  if (size <= 0) {
    return "empty";
  }
  if (size > MAX_AVATAR_BYTES) {
    return "too-large";
  }
  return null;
};

/**
 * Whether a bucket key has the `<userId>/avatar.<ext>` shape with an
 * image extension. The extension check is case-insensitive and also accepts
 * `jpeg` so legacy avatar objects remain readable (see AVATAR_READ_EXTENSIONS).
 */
export const isValidAvatarKey = (key: string): boolean => {
  const extension = AVATAR_KEY_PATTERN.exec(key)?.[1];
  return (
    extension !== undefined &&
    AVATAR_READ_EXTENSIONS.has(extension.toLowerCase())
  );
};

/**
 * Whether `key` is a well-formed avatar key owned by `userId` — the prefix
 * segment must equal the caller's id. Scopes reads to the caller's own
 * avatar so an authenticated user cannot enumerate others' objects.
 */
export const isOwnAvatarKey = (key: string, userId: string): boolean =>
  isValidAvatarKey(key) && key.startsWith(`${userId}/`);
