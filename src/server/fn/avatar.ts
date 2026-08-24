import { avatarGateway } from "@/gateways/avatar";
import type { AvatarObject } from "@/gateways/avatar";
import { getSession } from "@/lib/auth/session";
import { isOwnAvatarKey } from "@/lib/storage/avatar-validation";

export type AvatarReadResult =
  | { kind: "unauthorized" }
  | { kind: "invalid-key" }
  | { kind: "not-found" }
  | { kind: "found"; avatar: AvatarObject };

/**
 * The identity source and the avatar read this authorization check needs.
 *
 * Injected so a test drives the check without a session cookie or an R2
 * binding, and so the check itself stays the only thing under test.
 */
export interface AvatarReadDeps {
  readSession: () => Promise<Awaited<ReturnType<typeof getSession>>>;
  fetchAvatar: (key: string) => Promise<AvatarObject | null>;
}

export const createReadAvatarForCurrentUser =
  ({ fetchAvatar, readSession }: AvatarReadDeps) =>
  async (key: string | null): Promise<AvatarReadResult> => {
    const session = await readSession();
    if (!session?.user) {
      return { kind: "unauthorized" };
    }
    if (key === null || !isOwnAvatarKey(key, session.user.id)) {
      return { kind: "invalid-key" };
    }
    const avatar = await fetchAvatar(key);
    if (avatar === null) {
      return { kind: "not-found" };
    }
    return { avatar, kind: "found" };
  };

export const readAvatarForCurrentUser = createReadAvatarForCurrentUser({
  fetchAvatar: async (key) => await avatarGateway.fetchAvatar(key),
  readSession: getSession,
});
