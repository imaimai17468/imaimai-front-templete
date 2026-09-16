/** The path that serves an avatar object. */
export const AVATAR_ROUTE_PATH = "/api/avatars";

/** The URL that addresses the avatar object stored under `key`. */
export const avatarUrlForKey = (key: string): string =>
  `${AVATAR_ROUTE_PATH}?key=${encodeURIComponent(key)}`;
