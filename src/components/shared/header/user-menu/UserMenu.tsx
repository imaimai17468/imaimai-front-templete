"use client";

import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth";

type UserMenuProps = {
	user: {
		id: string;
		email?: string;
		user_metadata?: {
			avatar_url?: string;
			name?: string;
			user_name?: string;
		};
	};
};

export const UserMenu = ({ user }: UserMenuProps) => {
	const avatarUrl = user.user_metadata?.avatar_url;
	const name =
		user.user_metadata?.name || user.user_metadata?.user_name || "User";
	const email = user.email;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<Avatar className="h-8 w-8">
						<AvatarImage src={avatarUrl} alt={name} />
						<AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56" sideOffset={16}>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="font-medium text-sm leading-none">{name}</p>
						{email && (
							<p className="text-muted-foreground text-xs leading-none">
								{email}
							</p>
						)}
					</div>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href="/profile" className="cursor-pointer">
						<User className="mr-2 h-4 w-4" />
						<span>プロフィール</span>
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="cursor-pointer text-destructive focus:text-destructive"
					onClick={async () => {
						await signOut();
						window.location.reload();
					}}
				>
					<LogOut className="mr-2 h-4 w-4" />
					<span>ログアウト</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
