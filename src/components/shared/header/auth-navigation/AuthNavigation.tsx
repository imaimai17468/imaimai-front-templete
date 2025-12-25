import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { UserWithEmail } from "@/entities/user";
import { UserMenu } from "../user-menu/UserMenu";

type AuthNavigationProps = {
  user: UserWithEmail | null;
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
