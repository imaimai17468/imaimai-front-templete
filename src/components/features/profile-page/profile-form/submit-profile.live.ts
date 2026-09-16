import { updateProfileFn, uploadAvatarFn } from "@/gateways/user/profile";
import { fromWire } from "@/gateways/user/upload-avatar-wire";
import { createSubmitProfile } from "./submit-profile";

export const submitProfile = createSubmitProfile({
  updateProfile: (form) => updateProfileFn({ data: form }),
  uploadAvatar: (form) => uploadAvatarFn({ data: form }).then(fromWire),
});
