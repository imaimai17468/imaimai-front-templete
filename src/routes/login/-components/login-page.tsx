import { useSearch } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { PageTitle } from "@/shared/components/page-title/page-title";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { SignInButton } from "./sign-in-button";

export const LoginPage = () => {
  const { error } = useSearch({ from: "/login" });
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-4">
      <PageTitle>Sign In</PageTitle>
      {error !== undefined && (
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle />
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>Please try again.</AlertDescription>
        </Alert>
      )}
      <SignInButton />
    </div>
  );
};
