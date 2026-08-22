// All this flow reads is whether a result carries an error. `success` is here
// only so the type shares a property with the success-only shape, which is what
// stops TypeScript's weak-type check from rejecting it.
type ServerResult = {
  readonly error?: string;
  readonly success?: boolean;
};

export type ProfileSubmitDeps = {
  uploadAvatar: (file: File) => Promise<ServerResult>;
  updateProfile: (name: string) => Promise<ServerResult>;
};

export type ProfileSubmitInput = {
  name: string;
  avatar: File | null;
};

export type ProfileSubmitOutcome =
  | { kind: "failed"; message: string }
  | { kind: "succeeded" };

// The avatar upload runs first and short-circuits: a failed upload must not
// leave the name updated while the image the user picked was dropped.
export const submitProfile = async (
  input: ProfileSubmitInput,
  deps: ProfileSubmitDeps
): Promise<ProfileSubmitOutcome> => {
  if (input.avatar !== null) {
    const avatarResult = await deps.uploadAvatar(input.avatar);
    if (avatarResult.error !== undefined) {
      return { kind: "failed", message: avatarResult.error };
    }
  }

  const profileResult = await deps.updateProfile(input.name);
  if (profileResult.error !== undefined) {
    return { kind: "failed", message: profileResult.error };
  }

  return { kind: "succeeded" };
};
