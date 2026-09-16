import { Option } from "effect";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { devSignIn } from "@/lib/auth/dev-sign-in.live";
import { DEV_USERS } from "@/lib/auth/dev-users";
import type { DevUser } from "@/lib/auth/dev-users";

export const DevSignInPanel = () => {
  const [pendingEmail, setPendingEmail] = useState(() => Option.none<string>());

  const handleSignIn = (user: DevUser): Promise<void> => {
    setPendingEmail(Option.some(user.email));
    return devSignIn(user).then((result) => {
      if (result.kind === "failed") {
        setPendingEmail(Option.none());
        toast.error(result.message);
        return;
      }
      window.location.assign("/");
    });
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted px-6 py-4">
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium">Dev build only</p>
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          This button and email/password sign-in exist in dev builds alone. The
          deployed app signs in with Google.
        </p>
      </div>
      {DEV_USERS.map((user) => (
        <Button
          key={user.email}
          type="button"
          variant="outline"
          className="min-h-11 cursor-pointer"
          disabled={Option.isSome(pendingEmail)}
          onClick={() => {
            void handleSignIn(user);
          }}
        >
          {Option.contains(pendingEmail, user.email) && (
            <Loader2 className="motion-safe:animate-spin" />
          )}
          Sign in as {user.email}
        </Button>
      ))}
    </div>
  );
};
