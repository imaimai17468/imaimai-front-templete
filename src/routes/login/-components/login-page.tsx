import { PageTitle } from "@/shared/components/page-title/page-title";
import { SignInButton } from "./sign-in-button";

export const LoginPage = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
    <PageTitle>Sign In</PageTitle>
    <SignInButton />
  </div>
);
