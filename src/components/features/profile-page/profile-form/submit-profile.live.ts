import { updateProfileFn, uploadAvatarFn } from "@/gateways/user/update.fn";
import { createSubmitProfile } from "./submit-profile";

export const submitProfile = createSubmitProfile({
  updateProfile: (form) => updateProfileFn({ data: form }),
  uploadAvatar: (form) => uploadAvatarFn({ data: form }),
});
