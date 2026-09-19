import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UserWithEmail } from "@/shared/entities/user";
import { ProfileForm } from "./profile-form/profile-form";
import { formatRegisteredOn } from "./registered-on";

// similarity-ignore: コンポーネント固有の Props 契約。構造が `{ user }` と偶然一致するが責務は別。
interface ProfilePageProps {
  user: UserWithEmail;
}

export const ProfilePage = ({ user }: ProfilePageProps) => (
  <div className="container mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-8">
    <h1 className="text-3xl">Profile</h1>

    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            You can set your profile image and name
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm user={user} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Basic account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email Address</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Registration Date</p>
              <p className="font-medium">
                {formatRegisteredOn(user.createdAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);
