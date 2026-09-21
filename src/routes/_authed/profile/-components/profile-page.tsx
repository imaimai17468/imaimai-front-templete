import type { UserWithEmail } from "@/shared/entities/user";
import { ProfileForm } from "./profile-form/profile-form";
import { formatRegisteredOn } from "./registered-on";
import { SectionCard } from "./section-card";

export const ProfilePage = ({ user }: { readonly user: UserWithEmail }) => (
  <div className="container mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-8">
    <h1 className="text-3xl">Profile</h1>

    <div className="flex flex-col gap-6">
      <SectionCard
        title="Basic Information"
        description="You can set your profile image and name"
      >
        <ProfileForm user={user} />
      </SectionCard>

      <SectionCard
        title="Account Information"
        description="Basic account information"
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Email Address</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Registration Date</p>
            <p className="font-medium">{formatRegisteredOn(user.createdAt)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  </div>
);
