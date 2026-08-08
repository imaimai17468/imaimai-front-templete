import { createServerFn } from "@tanstack/react-start";
import { UpdateUserSchema } from "@/entities/user";
import {
  fetchCurrentUser,
  updateUser,
  updateUserAvatar,
} from "@/gateways/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected FormData");
    }
    return UpdateUserSchema.parse({ name: data.get("name") });
  })
  .handler(async ({ data }) => {
    const user = await fetchCurrentUser();
    if (!user) {
      return { error: "Not authenticated" } as const;
    }
    return updateUser(user.id, data);
  });

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected FormData");
    }
    const file = data.get("avatar");
    if (!(file instanceof File)) {
      throw new Error("No file selected");
    }
    // Enforced here, not only in the browser: uploadAvatarFn is callable
    // directly, so a client-side ceiling alone bounds nothing.
    switch (avatarSizeRejection(file.size)) {
      case "empty":
        throw new Error("No file selected");
      case "too-large":
        throw new Error(
          `Avatar must be ${MAX_AVATAR_BYTES / 1024 / 1024}MB or smaller`
        );
      // Exhaustive on purpose: a new rejection reason must fail this switch.
      case null:
        break;
    }
    return { file };
  })
  .handler(async ({ data }) => {
    const user = await fetchCurrentUser();
    if (!user) {
      return { error: "Not authenticated" } as const;
    }
    return updateUserAvatar(user.id, data.file);
  });
