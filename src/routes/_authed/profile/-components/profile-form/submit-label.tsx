import { Loader2 } from "lucide-react";

export const SubmitLabel = ({ isPending }: { readonly isPending: boolean }) => {
  if (isPending) {
    return (
      <>
        <Loader2 className="size-4 motion-safe:animate-spin" />
        Updating…
      </>
    );
  }
  return <>Update Profile</>;
};
