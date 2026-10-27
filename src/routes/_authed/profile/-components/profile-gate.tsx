import { useSuspenseQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { ProfilePage } from "./profile-page";

export const ProfileGate = () => {
  const { data: user } = useSuspenseQuery(currentUserQueryOptions());
  // A session that ends while this page stays mounted comes back as `null`
  // from the next refetch, and this is what answers it.
  if (user === null) {
    return <Navigate to="/login" />;
  }
  return <ProfilePage user={user} />;
};
