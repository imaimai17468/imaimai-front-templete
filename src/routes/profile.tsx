import {
  createFileRoute,
  redirect,
  useLoaderData,
} from "@tanstack/react-router";
import { ProfilePage } from "@/components/features/profile-page/profile-page";
import { getCurrentUserFn } from "@/server/fn/user";

const ProfileComponent = () => {
  const { user } = useLoaderData({ from: "/profile" });
  return <ProfilePage user={user} />;
};

export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    const user = await getCurrentUserFn();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  loader: ({ context }) => ({ user: context.user }),
  component: ProfileComponent,
});
