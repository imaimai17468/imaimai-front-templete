import { Link } from "@tanstack/react-router";
import { ModeToggle } from "@/components/shared/mode-toggle/mode-toggle";
import type { UserWithEmail } from "@/entities/user";
import { AuthNavigation } from "./auth-navigation/auth-navigation";

// similarity-ignore: Header と AuthNavigation はそれぞれ独立した責務（レイアウト vs 認証ナビ）の Props 契約。構造が偶然一致しているだけで共通化しない。
interface HeaderProps {
  user: UserWithEmail | null;
}

export const Header = ({ user }: HeaderProps) => (
  <header className="sticky top-0 z-50 bg-transparent backdrop-blur-md">
    <div className="flex items-center justify-between gap-3 p-6">
      <Link
        to="/"
        className="-mx-2 inline-flex min-h-11 min-w-0 items-center truncate rounded-md px-2 text-base font-medium tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-lg"
      >
        imaimai-front-templete
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        <ModeToggle />
        <AuthNavigation user={user} />
      </div>
    </div>
  </header>
);
