import { fetchAvatar, type AvatarObject } from "@/gateways/avatar";
import { getSession } from "@/lib/auth/session";
import { isOwnAvatarKey } from "@/lib/storage/avatar-validation";

export type AvatarReadResult =
  | { kind: "unauthorized" }
  | { kind: "invalid-key" }
  | { kind: "not-found" }
  | { kind: "found"; avatar: AvatarObject };

export const readAvatarForCurrentUser = async (
  key: string | null
): Promise<AvatarReadResult> => {
  const session = await getSession();
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
  return { kind: "found", avatar };
};
