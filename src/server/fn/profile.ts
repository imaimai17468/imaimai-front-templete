import { createServerFn } from "@tanstack/react-start";
import { UpdateUserSchema } from "@/entities/user";
import { userGateway } from "@/gateways/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import { getCurrentUser } from "@/server/fn/user";

export const updateProfileFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected FormData");
    }
    return UpdateUserSchema.parse({ name: data.get("name") });
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" } as const;
    }
    return await userGateway.updateUser(user.id, data);
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
    const rejection = avatarSizeRejection(file.size);
    switch (rejection) {
      case "empty": {
        throw new Error("No file selected");
      }
      case "too-large": {
        throw new Error(
          `Avatar must be ${MAX_AVATAR_BYTES / 1024 / 1024}MB or smaller`
        );
      }
      case null: {
        break;
      }
      // A new rejection reason fails to compile here rather than passing
      // silently, because it has no `never` to widen into.
      default: {
        const unhandled: never = rejection;
        return unhandled;
      }
    }
    return { file };
  })
  .handler(async ({ data }) => {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" } as const;
    }
    return await userGateway.updateUserAvatar(user.id, data.file);
  });
