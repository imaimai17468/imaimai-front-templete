import { redirect } from "next/navigation";
import { ProfilePage } from "@/components/features/profile-page/ProfilePage";
import { fetchCurrentUser } from "@/gateways/user";

export default async function Profile() {
  const user = await fetchCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <ProfilePage user={user} />;
}
