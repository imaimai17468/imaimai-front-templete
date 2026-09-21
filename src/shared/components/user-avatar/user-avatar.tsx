import { Option } from "effect";
import type { ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";

export const UserAvatar = ({
  avatarUrl,
  name,
  size,
}: {
  readonly avatarUrl: Option.Option<string>;
  readonly name: string;
  readonly size?: ComponentProps<typeof Avatar>["size"];
}) => (
  <Avatar size={size}>
    <AvatarImage src={Option.getOrUndefined(avatarUrl)} alt={name} />
    <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
  </Avatar>
);
