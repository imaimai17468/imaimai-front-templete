import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import type { UserWithEmail } from "@/shared/entities/user";
import { Button } from "@/shared/ui/button";
import { UserMenu } from "../user-menu/user-menu";

export const AuthNavigation = ({
  user,
}: {
  readonly user: Option.Option<UserWithEmail>;
}) => {
  if (Option.isSome(user)) {
    return <UserMenu user={user.value} />;
  }

  return (
    <Button asChild size="sm" className="min-h-11">
      <Link to="/login">Sign In</Link>
    </Button>
  );
};
