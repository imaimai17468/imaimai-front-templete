import { Link } from "@tanstack/react-router";
import type { UserWithEmail } from "@/shared/entities/user";
import { Button } from "@/shared/ui/button";
import { UserMenu } from "../user-menu/user-menu";

export const AuthNavigation = ({
  user,
}: {
  readonly user: UserWithEmail | null;
}) => {
  if (user !== null) {
    return <UserMenu user={user} />;
  }

  return (
    <Button asChild size="sm" className="min-h-11">
      <Link to="/login">Sign In</Link>
    </Button>
  );
};
