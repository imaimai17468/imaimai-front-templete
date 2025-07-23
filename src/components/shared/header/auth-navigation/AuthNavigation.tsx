import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserMenu } from "../user-menu/UserMenu";

type AuthNavigationProps = {
	user: {
		id: string;
		email?: string;
		user_metadata?: {
			avatar_url?: string;
			name?: string;
			user_name?: string;
		};
	} | null;
};

export const AuthNavigation = ({ user }: AuthNavigationProps) => {
	if (user) {
		return <UserMenu user={user} />;
	}

	return (
		<Button asChild size="sm" className="text-sm">
			<Link href="/login">Sign In</Link>
		</Button>
	);
};
