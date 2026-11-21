import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  avatarSizeVerdict,
  MAX_AVATAR_MEGABYTES,
} from "@/lib/storage/avatar-validation";
import type { AvatarSizeRejection } from "@/lib/storage/avatar-validation";
import { UpdateUserSchema } from "@/shared/entities/user/user";
import type { UpdateUser } from "@/shared/entities/user/user";
import { updateProfile, uploadAvatar } from "./update";

// The wire hands `.validator` whatever the client sent, so the contract starts
// at this schema rather than at a parameter annotation.
export const ProfileUpdateForm = Schema.toStandardSchemaV1(
  Schema.fromFormData(UpdateUserSchema)
);

const AVATAR_REJECTION_MESSAGES = {
  empty: "No file selected",
  "too-large": `Avatar must be ${MAX_AVATAR_MEGABYTES}MB or smaller`,
} satisfies Record<AvatarSizeRejection, string>;

const rejectsFor = (rejection: AvatarSizeRejection) =>
  Schema.makeFilter<File>(
    (file) => avatarSizeVerdict(file.size) !== rejection,
    {
      message: AVATAR_REJECTION_MESSAGES[rejection],
    }
  );

// Checked here, not only in the browser: uploadAvatarFn is callable directly,
// so a client-side ceiling alone bounds nothing.
const AvatarFileSchema = Schema.declare<File>(
  (input): input is File => input instanceof File,
  { message: AVATAR_REJECTION_MESSAGES.empty }
).check(rejectsFor("empty"), rejectsFor("too-large"));

export const AvatarUploadForm = Schema.toStandardSchemaV1(
  Schema.fromFormData(
    Schema.Struct({
      avatar: AvatarFileSchema.pipe(
        Schema.annotateKey({
          messageMissingKey: AVATAR_REJECTION_MESSAGES.empty,
        })
      ),
    })
  )
);

/** The body `updateProfileFn` takes, keyed as `ProfileUpdateForm` reads it. */
export const profileUpdateBody = (data: UpdateUser): FormData => {
  const body = new globalThis.FormData();
  body.append("name" satisfies keyof typeof ProfileUpdateForm.Type, data.name);
  return body;
};

/** The body `uploadAvatarFn` takes, keyed as `AvatarUploadForm` reads it. */
export const avatarUploadBody = (avatar: File): FormData => {
  const body = new globalThis.FormData();
  body.append("avatar" satisfies keyof typeof AvatarUploadForm.Type, avatar);
  return body;
};

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator(ProfileUpdateForm)
  .handler(({ data }) => updateProfile(data));

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .validator(AvatarUploadForm)
  .handler(({ data }) => uploadAvatar(data.avatar));
