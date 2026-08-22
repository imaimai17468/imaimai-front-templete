import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProfilePage } from "@/components/features/profile-page/ProfilePage";
import { fetchCurrentUser } from "@/client/user";

export const Route = createFileRoute("/profile")({
  beforeLoad: async ({ context }) => {
    const user = await fetchCurrentUser(context.queryClient);
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
