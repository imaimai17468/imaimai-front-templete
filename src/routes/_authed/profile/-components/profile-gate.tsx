import { useSuspenseQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { Option } from "effect";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { ProfilePage } from "./profile-page";

export const ProfileGate = () => {
  const { data: user } = useSuspenseQuery(currentUserQueryOptions());
  // A session that ends while this page stays mounted comes back as a `None`
  // from the next refetch, and this is what answers it.
  return Option.match(user, {
    onNone: () => <Navigate to="/login" />,
    onSome: (signedIn) => <ProfilePage user={signedIn} />,
  });
};
