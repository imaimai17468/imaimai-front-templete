import { UserWithEmailSchema } from "@/entities/user";
import type { UpdateUser, UserWithEmail } from "@/entities/user";
import {
  avatarContentMatchesMime,
  avatarExtensionForMime,
  avatarKeyFromUrl,
} from "@/lib/storage/avatar-validation";
import { deleteFromR2, uploadToR2 } from "@/lib/storage/r2";
import { drizzleUserStore } from "./drizzle-store";
import type { UserGatewayDeps } from "./ports";

export type UpdateUserAvatarResult =
  | {
      success: true;
      avatarUrl: string;
      cleanup: "complete" | "pending";
    }
  | {
      success: false;
      error: string;
      orphanedKey?: string;
    };

export const createUserGateway = ({
  newId,
  storage,
  store,
}: UserGatewayDeps) => {
  const fetchCurrentUser = async (
    userId: string,
    email: string
  ): Promise<UserWithEmail | null> => {
    const profile = await store.findProfile(userId);
    if (profile === null) {
      return null;
    }
    return UserWithEmailSchema.parse({
      avatarUrl: profile.image,
      createdAt: profile.createdAt.toISOString(),
      email,
      id: profile.id,
      name: profile.name,
      updatedAt: profile.updatedAt.toISOString(),
    });
  };

  const updateUser = async (
    userId: string,
    data: UpdateUser
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await store.updateName(userId, data.name);
      return { success: true };
    } catch {
      return { error: "Failed to update profile", success: false };
    }
  };

  // The previous avatar is deleted only after the row points at the new one, so
  // a failure between the two leaves an unreferenced object rather than a row
  // referencing a deleted one. `orphanedKey` names the object left behind when
  // even the rollback delete fails, which is the only state a caller cannot
  // reconstruct from the row.
  const updateUserAvatar = async (
    userId: string,
    file: File
  ): Promise<UpdateUserAvatarResult> => {
    const fileExt = avatarExtensionForMime(file.type);
    if (fileExt === null || !(await avatarContentMatchesMime(file))) {
      return { error: "Unsupported image type", success: false };
    }

    const current = await (async () => {
      try {
        return await store.findAvatarUrl(userId);
      } catch {
        return null;
      }
    })();
    if (current === null) {
      return { error: "Failed to upload avatar", success: false };
    }

    const previousKey =
      current.avatarUrl === null
        ? null
        : avatarKeyFromUrl(current.avatarUrl, userId);
    const key = `${userId}/avatars/${newId()}.${fileExt}`;

    const publicUrl = await (async () => {
      try {
        return await storage.upload(key, file, file.type);
      } catch {
        return null;
      }
    })();
    if (publicUrl === null) {
      return { error: "Failed to upload avatar", success: false };
    }

    const stored = await (async () => {
      try {
        return (await store.setAvatarUrl(userId, publicUrl)) === 1;
      } catch {
        return false;
      }
    })();
    if (!stored) {
      try {
        await storage.remove(key);
        return { error: "Failed to upload avatar", success: false };
      } catch {
        return {
          error: "Failed to upload avatar",
          orphanedKey: key,
          success: false,
        };
      }
    }

    if (previousKey === null) {
      return { avatarUrl: publicUrl, cleanup: "complete", success: true };
    }
    try {
      await storage.remove(previousKey);
      return { avatarUrl: publicUrl, cleanup: "complete", success: true };
    } catch {
      return { avatarUrl: publicUrl, cleanup: "pending", success: true };
    }
  };

  return { fetchCurrentUser, updateUser, updateUserAvatar };
};

export const userGateway = createUserGateway({
  newId: () => crypto.randomUUID(),
  storage: { remove: deleteFromR2, upload: uploadToR2 },
  store: drizzleUserStore,
});
