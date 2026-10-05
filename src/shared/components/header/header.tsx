import { Link } from "@tanstack/react-router";
import type { Option } from "effect";
import type { UserWithEmail } from "@/shared/entities/user";
import { AuthNavigation } from "./auth-navigation/auth-navigation";
import { ModeToggle } from "./mode-toggle/mode-toggle";

export const Header = ({
  user,
}: {
  readonly user: Option.Option<UserWithEmail>;
}) => (
  <header className="sticky top-0 z-50 bg-background backdrop-blur-md supports-backdrop-filter:bg-transparent">
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
