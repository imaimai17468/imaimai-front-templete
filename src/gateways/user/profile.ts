import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { flow, Schema } from "effect";
import { UpdateUserSchema } from "@/entities/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import type { AvatarSizeRejection } from "@/lib/storage/avatar-validation";
import { runUpdateProfile, runUploadAvatar } from "./profile-writer";

// The wire hands `.validator` whatever the client sent, so the contract starts
// at this schema rather than at a parameter annotation.
const FormDataSchema = Schema.declare<FormData>(
  (input): input is FormData => input instanceof FormData,
  { message: "Expected FormData" }
);

const decodeFormData = Schema.decodeUnknownSync(FormDataSchema);
const decodeUpdateUser = Schema.decodeUnknownSync(UpdateUserSchema);

export const parseProfileUpdate = flow(decodeFormData, (form) =>
  decodeUpdateUser({ name: form.get("name") })
);

const AVATAR_REJECTION_MESSAGES = {
  empty: "No file selected",
  "too-large": `Avatar must be ${MAX_AVATAR_BYTES / 1024 / 1024}MB or smaller`,
} satisfies Record<AvatarSizeRejection, string>;

export const parseAvatarUpload = flow(decodeFormData, (form) => {
  const file = form.get("avatar");
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
});

const updateProfile = createServerOnlyFn(runUpdateProfile);
const uploadAvatar = createServerOnlyFn(runUploadAvatar);

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(parseProfileUpdate)
  .handler(async ({ data }) => await updateProfile(data));

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .validator(parseAvatarUpload)
  .handler(async ({ data }) => await uploadAvatar(data.file));
