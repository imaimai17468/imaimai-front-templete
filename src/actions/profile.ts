"use server";

import { UpdateUserSchema } from "@/entities/user";
import {
  fetchCurrentUser,
  updateUser,
  updateUserAvatar,
} from "@/gateways/user";

export const updateProfile = async (formData: FormData) => {
  const user = await fetchCurrentUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;

  const validationResult = UpdateUserSchema.safeParse({ name });
  if (!validationResult.success) {
    return { error: validationResult.error.issues[0].message };
  }

  return updateUser(user.id, validationResult.data);
};

export const uploadAvatar = async (formData: FormData) => {
  const user = await fetchCurrentUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) {
    return { error: "No file selected" };
  }

  return updateUserAvatar(user.id, file);
};
