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

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const GIF87A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

const hasSignature = (
  bytes: Uint8Array,
  signature: number[],
  offset = 0
): boolean =>
  signature.every((expected, index) => bytes[offset + index] === expected);

export const avatarContentMatchesMime = async (
  file: File
): Promise<boolean> => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  switch (file.type) {
    case "image/png":
      return hasSignature(bytes, PNG_SIGNATURE);
    case "image/jpeg":
      return hasSignature(bytes, JPEG_SIGNATURE);
    case "image/webp":
      return (
        hasSignature(bytes, RIFF_SIGNATURE) &&
        hasSignature(bytes, WEBP_SIGNATURE, 8)
      );
    case "image/gif":
      return (
        hasSignature(bytes, GIF87A_SIGNATURE) ||
        hasSignature(bytes, GIF89A_SIGNATURE)
      );
    default:
      return false;
  }
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
  ...AVATAR_MIME_TO_EXTENSION.values(),
  "jpeg",
]);

const AVATAR_KEY_PATTERN =
  /^([A-Za-z0-9_-]+)\/(?:avatar|avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9]+)$/;

const parseAvatarKey = (
  key: string
): { ownerId: string; extension: string } | null => {
  const match = AVATAR_KEY_PATTERN.exec(key);
  const ownerId = match?.[1];
  const extension = match?.[2];
  if (
    ownerId === undefined ||
    extension === undefined ||
    !AVATAR_READ_EXTENSIONS.has(extension.toLowerCase())
  ) {
    return null;
  }
  return { ownerId, extension };
};

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
  return parseAvatarKey(key) !== null;
};

/**
 * Whether `key` is a well-formed avatar key owned by `userId` — the prefix
 * segment must equal the caller's id. Scopes reads to the caller's own
 * avatar so an authenticated user cannot enumerate others' objects.
 */
export const isOwnAvatarKey = (key: string, userId: string): boolean =>
  parseAvatarKey(key)?.ownerId === userId;

export const avatarKeyFromUrl = (
  avatarUrl: string,
  userId: string
): string | null => {
  if (!avatarUrl.startsWith("/api/avatars?")) {
    return null;
  }
  const key = new URL(avatarUrl, "https://avatar.internal").searchParams.get(
    "key"
  );
  return key !== null && isOwnAvatarKey(key, userId) ? key : null;
};
