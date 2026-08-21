import { updateProfileFn, uploadAvatarFn } from "@/server/fn/profile";
import {
  type ProfileSubmitInput,
  type ProfileSubmitOutcome,
  submitProfile,
} from "./profile-submit";

// The one place the UI's data access binds to the server boundary. Phase 4
// replaces the two imports above with the oRPC client; the shape stays.
export const submitProfileToServer = async (
  input: ProfileSubmitInput
): Promise<ProfileSubmitOutcome> =>
  submitProfile(input, {
    uploadAvatar: async (body) => uploadAvatarFn({ data: body }),
    updateProfile: async (body) => updateProfileFn({ data: body }),
  });
