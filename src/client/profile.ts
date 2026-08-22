import {
  type ProfileSubmitInput,
  type ProfileSubmitOutcome,
  submitProfile,
} from "./profile-submit";
import { orpc } from "./orpc";

// The one place the UI's data access binds to the server boundary.
export const submitProfileToServer = async (
  input: ProfileSubmitInput
): Promise<ProfileSubmitOutcome> =>
  submitProfile(input, {
    uploadAvatar: async (file) => orpc.profile.uploadAvatar.call({ file }),
    updateProfile: async (name) => orpc.profile.update.call({ name }),
  });
