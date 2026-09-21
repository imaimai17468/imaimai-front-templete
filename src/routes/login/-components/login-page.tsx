import { SignInButton } from "./sign-in-button";

export const LoginPage = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
    <h1 className="text-2xl font-semibold tracking-tight">Sign In</h1>
    <SignInButton />
  </div>
);
