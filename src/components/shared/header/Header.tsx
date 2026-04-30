import { Link } from "@tanstack/react-router";
import { ModeToggle } from "@/components/shared/mode-toggle/ModeToggle";
import type { UserWithEmail } from "@/entities/user";
import { AuthNavigation } from "./auth-navigation/AuthNavigation";

// similarity-ignore: Header と AuthNavigation はそれぞれ独立した責務（レイアウト vs 認証ナビ）の Props 契約。構造が偶然一致しているだけで共通化しない。
type HeaderProps = {
  user: UserWithEmail | null;
};

export const Header = ({ user }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 bg-transparent backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-6">
        <div>
          <h1 className="font-medium text-2xl">
            <Link to="/">Title</Link>
          </h1>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/" className="text-gray-400 text-sm">
            Link1
          </Link>
          <Link to="/" className="text-gray-400 text-sm">
            Link2
          </Link>
          <ModeToggle />
          <AuthNavigation user={user} />
        </div>
      </div>
    </header>
  );
};
