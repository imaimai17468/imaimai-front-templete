import type { ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";

export const UserAvatar = ({
  avatarUrl,
  name,
  size,
}: {
  readonly avatarUrl: string | null;
  readonly name: string;
  readonly size?: ComponentProps<typeof Avatar>["size"];
}) => (
  <Avatar size={size}>
    <AvatarImage src={avatarUrl ?? undefined} alt={name} />
    <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
  </Avatar>
);
