import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth/sign-in";

export const SignInButton = () => {
  const [pending, setPending] = useState(false);

  // Both outcomes that leave the page keep the spinner up, so the back/forward
  // cache can restore this button pending with no request behind it. `pageshow`
  // is the event that restore fires, and it also fires on an ordinary load,
  // where the flag is already false.
  useEffect(() => {
    const clearPending = () => {
      setPending(false);
    };
    window.addEventListener("pageshow", clearPending);
    return () => {
      window.removeEventListener("pageshow", clearPending);
    };
  }, []);

  const handleSignIn = (): Promise<void> => {
    setPending(true);
    return signIn().then((outcome) => {
      switch (outcome.kind) {
        case "failed": {
          setPending(false);
          toast.error(outcome.message);
          break;
        }
        case "signed-in": {
          window.location.assign("/");
          break;
        }
        // Better Auth's client already assigned window.location, so the
        // spinner stays up until that navigation replaces the page.
        case "redirecting": {
          break;
        }
        default: {
          outcome satisfies never;
        }
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11 cursor-pointer"
      disabled={pending}
      onClick={() => {
        void handleSignIn();
      }}
    >
      {pending && <Loader2 className="motion-safe:animate-spin" />}
      Sign in With Google
    </Button>
  );
};
