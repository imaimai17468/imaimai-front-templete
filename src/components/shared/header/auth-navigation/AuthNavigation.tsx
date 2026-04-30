import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { UserWithEmail } from "@/entities/user";
import { UserMenu } from "../user-menu/UserMenu";

// similarity-ignore: Header と構造が偶然一致するが、認証ナビゲーション固有の Props 契約。
type AuthNavigationProps = {
  user: UserWithEmail | null;
};

export const AuthNavigation = ({ user }: AuthNavigationProps) => {
  if (user) {
    return <UserMenu user={user} />;
  }

  return (
    <Button asChild size="sm" className="text-sm">
      <Link to="/login">Sign In</Link>
    </Button>
  );
};
