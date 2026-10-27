import type { UpdateUser } from "@/shared/entities/user";
import type {
  UpdateProfileResult,
  UploadAvatarResult,
} from "@/shared/gateway/user/update";
import {
  updateProfileFn,
  uploadAvatarFn,
} from "@/shared/gateway/user/update.fn";

export interface SubmitProfileDeps {
  readonly updateProfile: (form: FormData) => Promise<UpdateProfileResult>;
  readonly uploadAvatar: (form: FormData) => Promise<UploadAvatarResult>;
}

/**
 * What one submission did, as the two things the form acts on: whether the
 * pending file now lives in the bucket, and what to tell the user.
 *
 * `avatarUploaded` is on every arm, because a stored avatar followed by a
 * failed name write still clears the pending file.
 */
interface ProfileSubmission {
  readonly avatarUploaded: boolean;
  readonly outcome:
    | { readonly status: "saved" }
    | { readonly status: "failed"; readonly message: string };
}

const uploadPendingAvatar = (
  uploadAvatar: SubmitProfileDeps["uploadAvatar"],
  pendingFile: File
): Promise<UploadAvatarResult> => {
  const avatarForm = new globalThis.FormData();
  avatarForm.append("avatar", pendingFile);
  return uploadAvatar(avatarForm);
};

const saveName = (
  updateProfile: SubmitProfileDeps["updateProfile"],
  data: UpdateUser,
  avatarUploaded: boolean
): Promise<ProfileSubmission> => {
  const profileForm = new globalThis.FormData();
  profileForm.append("name", data.name);
  return updateProfile(profileForm).then((updated) => {
    if (updated.status === "failed") {
      return {
        avatarUploaded,
        outcome: { message: updated.message, status: "failed" },
      } satisfies ProfileSubmission;
    }
    return {
      avatarUploaded,
      outcome: { status: "saved" },
    } satisfies ProfileSubmission;
  });
};

/**
 * Runs one profile submission: the pending avatar first, so a failed upload
 * leaves the name untouched, then the name.
 */
export const createSubmitProfile =
  ({ updateProfile, uploadAvatar }: SubmitProfileDeps) =>
  (data: UpdateUser, pendingFile: File | null): Promise<ProfileSubmission> => {
    if (pendingFile === null) {
      return saveName(updateProfile, data, false);
    }
    return uploadPendingAvatar(uploadAvatar, pendingFile).then((uploaded) => {
      if (uploaded.status === "failed") {
        return {
          avatarUploaded: false,
          outcome: { message: uploaded.message, status: "failed" },
        } satisfies ProfileSubmission;
      }
      return saveName(updateProfile, data, true);
    });
  };

export const submitProfile = createSubmitProfile({
  updateProfile: (form) => updateProfileFn({ data: form }),
  uploadAvatar: (form) => uploadAvatarFn({ data: form }),
});
