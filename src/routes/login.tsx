import { createFileRoute } from "@tanstack/react-router";
import { SignInButton } from "@/components/features/login-page/sign-in-button";

const LoginComponent = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
    <p>message</p>
    <SignInButton />
  </div>
);

export const Route = createFileRoute("/login")({
  component: LoginComponent,
});
