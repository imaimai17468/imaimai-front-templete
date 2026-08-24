import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { UserWithEmail } from "@/entities/user";
import { UserMenu } from "../user-menu/user-menu";

// similarity-ignore: Header と構造が偶然一致するが、認証ナビゲーション固有の Props 契約。
interface AuthNavigationProps {
  user: UserWithEmail | null;
}

export const AuthNavigation = ({ user }: AuthNavigationProps) => {
  if (user) {
    return <UserMenu user={user} />;
  }

  return (
    <Button asChild size="sm" className="min-h-11 text-sm">
      <Link to="/login">Sign In</Link>
    </Button>
  );
};
