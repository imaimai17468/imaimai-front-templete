import { Link } from "@tanstack/react-router";
import { Option } from "effect";
import type { UserWithEmail } from "@/shared/entities/user";
import { Button } from "@/shared/ui/button";
import { UserMenu } from "../user-menu/user-menu";

// similarity-ignore: Header と構造が偶然一致するが、認証ナビゲーション固有の Props 契約。
interface AuthNavigationProps {
  user: Option.Option<UserWithEmail>;
}

export const AuthNavigation = ({ user }: AuthNavigationProps) => {
  if (Option.isSome(user)) {
    return <UserMenu user={user.value} />;
  }

  return (
    <Button asChild size="sm" className="min-h-11">
      <Link to="/login">Sign In</Link>
    </Button>
  );
};
