import { z } from "zod";

/**
 * @public
 * テンプレートの User エンティティ。現在のページでは派生型 UserWithEmail のみ使用しているが、
 * 派生プロジェクトで単体 User バリデーションが必要になる想定で export を維持する。
 */
export const UserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** @public テンプレート用途で公開。UserSchema と対になる型。 */
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

/** @public アバター URL 更新用スキーマ。テンプレ用途で公開、派生実装で使う想定。 */
export const UpdateAvatarSchema = z.object({
  avatarUrl: z.string().url(),
});

/** @public UpdateAvatarSchema と対になる型。 */
export type UpdateAvatar = z.infer<typeof UpdateAvatarSchema>;
