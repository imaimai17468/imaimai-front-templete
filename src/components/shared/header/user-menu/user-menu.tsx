import { Link } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayName } from "@/entities/user";
import type { UserWithEmail } from "@/entities/user";
import { signOut } from "@/lib/auth/actions.live";

// similarity-ignore: コンポーネント固有の Props 契約。構造が `{ user }` と偶然一致するが責務は別。
interface UserMenuProps {
  user: UserWithEmail;
}

const handleSignOut = (): Promise<void> =>
  signOut().then(() => {
    window.location.reload();
  });

export const UserMenu = ({ user }: UserMenuProps) => {
  const { avatarUrl } = user;
  const name = displayName(user.name);
  const { email } = user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cursor-pointer rounded-full focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
        >
          <Avatar>
            <AvatarImage src={avatarUrl ?? undefined} alt={name} />
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" sideOffset={16}>
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p className="text-sm leading-none font-medium">{name}</p>
            {email && (
              <p className="text-xs leading-none font-normal text-muted-foreground">
                {email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <UserIcon className="mr-2 size-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={() => {
            void handleSignOut();
          }}
        >
          <LogOut className="mr-2 size-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
