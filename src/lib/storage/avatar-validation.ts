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

const AVATAR_EXTENSIONS = [...new Set(Object.values(AVATAR_MIME_TO_EXTENSION))];

const AVATAR_KEY_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]+/avatar\\.(${AVATAR_EXTENSIONS.join("|")})$`
);

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

/** Whether a bucket key has the exact `<userId>/avatar.<ext>` shape. */
export const isValidAvatarKey = (key: string): boolean =>
  AVATAR_KEY_PATTERN.test(key);

/**
 * Whether `key` is a well-formed avatar key owned by `userId` — the prefix
 * segment must equal the caller's id. Scopes reads to the caller's own
 * avatar so an authenticated user cannot enumerate others' objects.
 */
export const isOwnAvatarKey = (key: string, userId: string): boolean =>
  isValidAvatarKey(key) && key.startsWith(`${userId}/`);
