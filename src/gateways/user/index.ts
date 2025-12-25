import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  type UpdateUser,
  type UserWithEmail,
  UserWithEmailSchema,
} from "@/entities/user";
import { db } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import { createClient } from "@/lib/supabase/server";

export const fetchCurrentUser = async (): Promise<UserWithEmail | null> => {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

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
    avatarUrl: profile[0].avatarUrl,
    createdAt: profile[0].createdAt.toISOString(),
    updatedAt: profile[0].updatedAt.toISOString(),
    email: authUser.email,
  };

  return UserWithEmailSchema.parse(rawUser);
};

export const updateUser = async (
  userId: string,
  data: UpdateUser,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await db
      .update(users)
      .set({
        name: data.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath("/profile");
    return { success: true };
  } catch (_error) {
    return { success: false, error: "Failed to update profile" };
  }
};

export const updateUserAvatar = async (
  userId: string,
  file: File,
): Promise<{ success: boolean; error?: string; avatarUrl?: string }> => {
  const supabase = await createClient();

  const fileExt = file.name.split(".").pop();
  const fileName = `${userId}/avatar.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, file, {
      upsert: true,
    });

  if (uploadError) {
    return { success: false, error: "Failed to upload avatar" };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(fileName);

  try {
    await db
      .update(users)
      .set({
        avatarUrl: publicUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    revalidatePath("/profile");
    return { success: true, avatarUrl: publicUrl };
  } catch (_error) {
    return { success: false, error: "Failed to update profile" };
  }
};
