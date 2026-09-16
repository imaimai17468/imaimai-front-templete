import { Effect } from "effect";
import type { UpdateUser } from "@/entities/user";
import type {
  UpdateProfileResult,
  UploadAvatarResult,
} from "@/gateways/user/profile-writer";

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
export interface ProfileSubmission {
  readonly avatarUploaded: boolean;
  readonly outcome:
    | { readonly status: "saved" }
    | { readonly status: "failed"; readonly message: string };
}

const uploadPendingAvatar = (
  uploadAvatar: SubmitProfileDeps["uploadAvatar"],
  pendingFile: File
) => {
  const avatarForm = new globalThis.FormData();
  avatarForm.append("avatar", pendingFile);
  return Effect.promise(() => uploadAvatar(avatarForm));
};

const saveName = Effect.fn("saveName")(function* saveName(
  updateProfile: SubmitProfileDeps["updateProfile"],
  data: UpdateUser,
  avatarUploaded: boolean
) {
  const profileForm = new globalThis.FormData();
  profileForm.append("name", data.name);
  const updated = yield* Effect.promise(() => updateProfile(profileForm));
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

/**
 * Runs one profile submission: the pending avatar first, so a failed upload
 * leaves the name untouched, then the name.
 */
export const createSubmitProfile =
  ({ updateProfile, uploadAvatar }: SubmitProfileDeps) =>
  (data: UpdateUser, pendingFile: File | null): Promise<ProfileSubmission> =>
    Effect.runPromise(
      Effect.gen(function* submitProfile() {
        if (pendingFile === null) {
          return yield* saveName(updateProfile, data, false);
        }
        const uploaded = yield* uploadPendingAvatar(uploadAvatar, pendingFile);
        if (uploaded.status === "failed") {
          return {
            avatarUploaded: false,
            outcome: { message: uploaded.message, status: "failed" },
          } satisfies ProfileSubmission;
        }
        return yield* saveName(updateProfile, data, true);
      })
    );
