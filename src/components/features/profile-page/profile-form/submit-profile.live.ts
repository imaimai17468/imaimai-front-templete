import { updateProfileFn, uploadAvatarFn } from "@/gateways/user/profile";
import { createSubmitProfile } from "./submit-profile";

export const submitProfile = createSubmitProfile({
  updateProfile: (form) => updateProfileFn({ data: form }),
  uploadAvatar: (form) => uploadAvatarFn({ data: form }),
});
