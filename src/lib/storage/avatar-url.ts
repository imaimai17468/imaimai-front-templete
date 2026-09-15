import { isOwnAvatarKey } from "./avatar-validation";

/**
 * The path that serves an avatar object. Its type is that literal rather than
 * `string`, so a caller can pin it against the paths the router serves and
 * reach a compile error rather than a 404 when the two diverge.
 */
export const AVATAR_ROUTE_PATH = "/api/avatars";

/**
 * The URL a user row stores for an avatar object, built from its bucket key.
 */
export const avatarUrlForKey = (key: string): string =>
  `${AVATAR_ROUTE_PATH}?key=${encodeURIComponent(key)}`;

/**
 * The bucket key `avatarUrl` addresses, or `null` when the URL is not one
 * `avatarUrlForKey` built for `userId`: an external image, another path, or a
 * key whose owner segment names somebody else.
 */
export const avatarKeyFromUrl = (
  avatarUrl: string,
  userId: string
): string | null => {
  if (!avatarUrl.startsWith(`${AVATAR_ROUTE_PATH}?`)) {
    return null;
  }
  const key = new URL(avatarUrl, "https://avatar.internal").searchParams.get(
    "key"
  );
  return key !== null && isOwnAvatarKey(key, userId) ? key : null;
};
