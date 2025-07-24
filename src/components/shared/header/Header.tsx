import Link from "next/link";
import { fetchCurrentUser } from "@/gateways/user";
import { AuthNavigation } from "./auth-navigation/AuthNavigation";

export const Header = async () => {
	const user = await fetchCurrentUser();

	return (
		<header className="fixed top-0 right-0 left-0 z-50">
			<div className="flex items-center justify-between px-6 py-6">
				<div>
					<h1 className="font-medium text-2xl">
						<Link href="/">Title</Link>
					</h1>
				</div>
				<div className="flex items-center gap-5">
					<Link href="/link1" className="text-gray-400 text-sm">
						Link1
					</Link>
					<Link href="/link2" className="text-gray-400 text-sm">
						Link2
					</Link>
					<AuthNavigation user={user} />
				</div>
			</div>
		</header>
	);
};
