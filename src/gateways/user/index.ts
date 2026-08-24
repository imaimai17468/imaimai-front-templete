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

/**
 * The value `read` resolved to, or null when it rejected.
 *
 * Every failure on the avatar path collapses into one user-facing result, so a
 * rejected read and an absent row reach the caller the same way. That includes
 * a missing D1 or R2 binding, which surfaces as an upload failure rather than
 * propagating.
 */
const orNull = async <T>(read: () => Promise<T>): Promise<T | null> => {
  try {
    return await read();
  } catch {
    return null;
  }
};

/**
 * Whether `act` resolved. A rejection is the caller's branch rather than an
 * error, because the avatar path reports a failed delete as a distinct result.
 */
const succeeded = async (act: () => Promise<void>): Promise<boolean> => {
  try {
    await act();
    return true;
  } catch {
    return false;
  }
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

    const current = await orNull(async () => await store.findAvatarUrl(userId));
    if (current === null) {
      return { error: "Failed to upload avatar", success: false };
    }

    const previousKey =
      current.avatarUrl === null
        ? null
        : avatarKeyFromUrl(current.avatarUrl, userId);
    const key = `${userId}/avatars/${newId()}.${fileExt}`;

    const publicUrl = await orNull(
      async () => await storage.upload(key, file, file.type)
    );
    if (publicUrl === null) {
      return { error: "Failed to upload avatar", success: false };
    }

    const rowsTouched = await orNull(
      async () => await store.setAvatarUrl(userId, publicUrl)
    );
    if (rowsTouched !== 1) {
      const rolledBack = await succeeded(async () => {
        await storage.remove(key);
      });
      return rolledBack
        ? { error: "Failed to upload avatar", success: false }
        : {
            error: "Failed to upload avatar",
            orphanedKey: key,
            success: false,
          };
    }

    if (previousKey === null) {
      return { avatarUrl: publicUrl, cleanup: "complete", success: true };
    }
    const removedPrevious = await succeeded(async () => {
      await storage.remove(previousKey);
    });
    return {
      avatarUrl: publicUrl,
      cleanup: removedPrevious ? "complete" : "pending",
      success: true,
    };
  };

  return { fetchCurrentUser, updateUser, updateUserAvatar };
};

export const userGateway = createUserGateway({
  newId: () => crypto.randomUUID(),
  storage: { remove: deleteFromR2, upload: uploadToR2 },
  store: drizzleUserStore,
});
