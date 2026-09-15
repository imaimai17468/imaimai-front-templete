import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { UpdateUserSchema } from "@/entities/user";
import type { UpdateUser } from "@/entities/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import type { AvatarSizeRejection } from "@/lib/storage/avatar-validation";
import { runUpdateProfile, runUploadAvatar } from "./profile-writer";

const decodeUpdateUser = Schema.decodeUnknownSync(UpdateUserSchema);

export const parseProfileUpdate = (data: unknown): UpdateUser => {
  if (!(data instanceof FormData)) {
    throw new Error("Expected FormData");
  }
  return decodeUpdateUser({ name: data.get("name") });
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

const updateProfile = createServerOnlyFn(runUpdateProfile);
const uploadAvatar = createServerOnlyFn(runUploadAvatar);

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(parseProfileUpdate)
  .handler(async ({ data }) => await updateProfile(data));

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .validator(parseAvatarUpload)
  .handler(async ({ data }) => await uploadAvatar(data.file));
