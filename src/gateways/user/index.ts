import { eq } from "drizzle-orm";
import {
  type UpdateUser,
  type UserWithEmail,
  UserWithEmailSchema,
} from "@/entities/user";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import { uploadToR2 } from "@/lib/storage/r2";

export const fetchCurrentUser = async (): Promise<UserWithEmail | null> => {
  const session = await getSession();

  if (!session?.user) {
    return null;
  }

  const db = getDb();
  const authUser = session.user;

  const profile = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (!profile.length) {
    return null;
  }

  const rawUser = {
    id: profile[0].id,
    name: profile[0].name,
    avatarUrl: profile[0].image,
    createdAt: profile[0].createdAt.toISOString(),
    updatedAt: profile[0].updatedAt.toISOString(),
    email: authUser.email,
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

export const updateUserAvatar = async (
  userId: string,
  file: File
): Promise<{ success: boolean; error?: string; avatarUrl?: string }> => {
  const fileExt = file.name.split(".").pop();
  const key = `${userId}/avatar.${fileExt}`;

  try {
    const publicUrl = await uploadToR2(key, file, file.type);

    const db = getDb();
    await db
      .update(users)
      .set({ image: publicUrl, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true, avatarUrl: publicUrl };
  } catch {
    return { success: false, error: "Failed to upload avatar" };
  }
};
