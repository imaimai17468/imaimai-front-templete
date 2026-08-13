import { eq } from "drizzle-orm";
import {
  type UpdateUser,
  type UserWithEmail,
  UserWithEmailSchema,
} from "@/entities/user";
import { getDb } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import {
  avatarContentMatchesMime,
  avatarExtensionForMime,
  avatarKeyFromUrl,
} from "@/lib/storage/avatar-validation";
import { deleteFromR2, uploadToR2 } from "@/lib/storage/r2";

export const fetchCurrentUser = async (
  userId: string,
  email: string
): Promise<UserWithEmail | null> => {
  const db = getDb();

  const profile = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [profileRow] = profile;
  if (profileRow === undefined) {
    return null;
  }

  const rawUser = {
    id: profileRow.id,
    name: profileRow.name,
    avatarUrl: profileRow.image,
    createdAt: profileRow.createdAt.toISOString(),
    updatedAt: profileRow.updatedAt.toISOString(),
    email,
  };

  return UserWithEmailSchema.parse(rawUser);
};

export const updateUser = async (
  userId: string,
  data: UpdateUser
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getDb();
    await db
      .update(users)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(users.id, userId));
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update profile" };
  }
};

type UpdateUserAvatarResult =
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

export const updateUserAvatar = async (
  userId: string,
  file: File
): Promise<UpdateUserAvatarResult> => {
  const fileExt = avatarExtensionForMime(file.type);
  if (fileExt === null || !(await avatarContentMatchesMime(file))) {
    return { success: false, error: "Unsupported image type" };
  }

  const db = getDb();
  let currentAvatarUrl: string | null;
  try {
    const currentRows = await db
      .select({ avatarUrl: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [currentRow] = currentRows;
    if (currentRow === undefined) {
      return { success: false, error: "Failed to upload avatar" };
    }
    currentAvatarUrl = currentRow.avatarUrl;
  } catch {
    return { success: false, error: "Failed to upload avatar" };
  }

  const previousKey =
    currentAvatarUrl === null
      ? null
      : avatarKeyFromUrl(currentAvatarUrl, userId);
  const key = `${userId}/avatars/${crypto.randomUUID()}.${fileExt}`;
  let publicUrl: string;
  try {
    publicUrl = await uploadToR2(key, file, file.type);
  } catch {
    return { success: false, error: "Failed to upload avatar" };
  }

  try {
    const updatedRows = await db
      .update(users)
      .set({ image: publicUrl, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (updatedRows.length !== 1) {
      throw new Error("Avatar update affected an unexpected number of rows");
    }
  } catch {
    try {
      await deleteFromR2(key);
      return { success: false, error: "Failed to upload avatar" };
    } catch {
      return {
        success: false,
        error: "Failed to upload avatar",
        orphanedKey: key,
      };
    }
  }

  if (previousKey === null) {
    return { success: true, avatarUrl: publicUrl, cleanup: "complete" };
  }
  try {
    await deleteFromR2(previousKey);
    return { success: true, avatarUrl: publicUrl, cleanup: "complete" };
  } catch {
    return { success: true, avatarUrl: publicUrl, cleanup: "pending" };
  }
};
