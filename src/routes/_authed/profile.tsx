import { useSuspenseQuery } from "@tanstack/react-query";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { ProfilePage } from "@/components/features/profile-page/profile-page";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";

const ProfileComponent = () => {
  const { data: user } = useSuspenseQuery(currentUserQueryOptions());
  // A session that ends while this page stays mounted comes back as a `None`
  // from the next refetch, and this is what answers it.
  return Option.match(user, {
    onNone: () => <Navigate to="/login" />,
    onSome: (signedIn) => <ProfilePage user={signedIn} />,
  });
};

export const Route = createFileRoute("/_authed/profile")({
  component: ProfileComponent,
});
