import { os } from "@orpc/server";
import * as z from "zod";
import { UpdateUserSchema } from "@/entities/user";
import { updateUser, updateUserAvatar } from "@/gateways/user";
import {
  avatarSizeRejection,
  MAX_AVATAR_BYTES,
} from "@/lib/storage/avatar-validation";
import { withUser } from "./middleware";

// Enforced server-side, not only in the browser: this procedure is callable
// directly, so a client-side ceiling alone bounds nothing.
const AvatarSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => {
      const rejection = avatarSizeRejection(file.size);
      switch (rejection) {
        case "empty":
        case "too-large":
          return false;
        // Exhaustive on purpose: a new rejection reason must fail this switch.
        case null:
          break;
      }
      return rejection === null;
    },
    `Avatar must be between 1 byte and ${MAX_AVATAR_BYTES / 1024 / 1024}MB`
  ),
});

export const update = os
  .use(withUser)
  .input(UpdateUserSchema)
  .handler(async ({ context, input }) => {
    if (!context.user) {
      return { error: "Not authenticated" } as const;
    }
    return updateUser(context.user.id, input);
  });

export const uploadAvatar = os
  .use(withUser)
  .input(AvatarSchema)
  .handler(async ({ context, input }) => {
    if (!context.user) {
      return { error: "Not authenticated" } as const;
    }
    return updateUserAvatar(context.user.id, input.file);
  });
