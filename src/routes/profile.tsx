import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProfilePage } from "@/components/features/profile-page/ProfilePage";
import { getCurrentUserFn } from "@/server/fn/user";

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

function ProfileComponent() {
  const { user } = Route.useLoaderData();
  return <ProfilePage user={user} />;
}
