import { createServerFn } from "@tanstack/react-start";
import { UpdateUserSchema } from "@/entities/user";
import type { UpdateUser, UserWithEmail } from "@/entities/user";
import { userGateway } from "@/gateways/user";
import type { UpdateUserAvatarResult } from "@/gateways/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import type { AvatarSizeRejection } from "@/lib/storage/avatar-validation";
import { getCurrentUser } from "@/server/fn/user";

export const parseProfileUpdate = (data: unknown): UpdateUser => {
  if (!(data instanceof FormData)) {
    throw new Error("Expected FormData");
  }
  return UpdateUserSchema.parse({ name: data.get("name") });
};

const AVATAR_REJECTION_MESSAGES = {
  empty: "No file selected",
  "too-large": `Avatar must be ${MAX_AVATAR_BYTES / 1024 / 1024}MB or smaller`,
} satisfies Record<AvatarSizeRejection, string>;

export const parseAvatarUpload = (data: unknown) => {
  if (!(data instanceof FormData)) {
    throw new Error("Expected FormData");
  }
  const file = data.get("avatar");
  if (!(file instanceof File)) {
    throw new Error("No file selected");
  }
  // Enforced here, not only in the browser: uploadAvatarFn is callable
  // directly, so a client-side ceiling alone bounds nothing.
  const rejection = avatarSizeRejection(file.size);
  if (rejection !== null) {
    throw new Error(AVATAR_REJECTION_MESSAGES[rejection]);
  }
  return { file };
};

type ReadCurrentUser = () => Promise<UserWithEmail | null>;

/**
 * The identity source and the profile write this server function needs.
 *
 * Injected so a test drives the authorization path without a session cookie or
 * a D1 binding.
 */
export interface ProfileUpdateDeps {
  readCurrentUser: ReadCurrentUser;
  updateUser: (
    userId: string,
    data: UpdateUser
  ) => Promise<{ success: boolean; error?: string }>;
}

export const createUpdateProfile =
  ({ readCurrentUser, updateUser }: ProfileUpdateDeps) =>
  async (data: UpdateUser) => {
    const user = await readCurrentUser();
    if (!user) {
      return { error: "Not authenticated" } as const;
    }
    return await updateUser(user.id, data);
  };

/**
 * The identity source and the avatar write this server function needs.
 *
 * Injected so a test drives the authorization path without a session cookie or
 * an R2 binding.
 */
export interface AvatarUploadDeps {
  readCurrentUser: ReadCurrentUser;
  updateUserAvatar: (
    userId: string,
    file: File
  ) => Promise<UpdateUserAvatarResult>;
}

export const createUploadAvatar =
  ({ readCurrentUser, updateUserAvatar }: AvatarUploadDeps) =>
  async ({ file }: { file: File }) => {
    const user = await readCurrentUser();
    if (!user) {
      return { error: "Not authenticated" } as const;
    }
    return await updateUserAvatar(user.id, file);
  };

const updateProfile = createUpdateProfile({
  readCurrentUser: getCurrentUser,
  updateUser: async (userId, data) =>
    await userGateway.updateUser(userId, data),
});

const uploadAvatar = createUploadAvatar({
  readCurrentUser: getCurrentUser,
  updateUserAvatar: async (userId, file) =>
    await userGateway.updateUserAvatar(userId, file),
});

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(parseProfileUpdate)
  .handler(async ({ data }) => await updateProfile(data));

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .validator(parseAvatarUpload)
  .handler(async ({ data }) => await uploadAvatar(data));
