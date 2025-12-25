import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string(), // Supabaseはカスタム形式のタイムスタンプを返す
  updatedAt: z.string(), // Supabaseはカスタム形式のタイムスタンプを返す
});

export type User = z.infer<typeof UserSchema>;

export const UserWithEmailSchema = UserSchema.extend({
  email: z.string().email(),
});

export type UserWithEmail = z.infer<typeof UserWithEmailSchema>;

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const UpdateAvatarSchema = z.object({
  avatarUrl: z.string().url(),
});

export type UpdateAvatar = z.infer<typeof UpdateAvatarSchema>;
