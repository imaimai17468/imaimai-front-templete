import { createServerFn } from "@tanstack/react-start";
import { UpdateUserSchema } from "@/entities/user";
import {
  fetchCurrentUser,
  updateUser,
  updateUserAvatar,
} from "@/gateways/user";

export const updateProfileFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
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
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected FormData");
    }
    const file = data.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("No file selected");
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
