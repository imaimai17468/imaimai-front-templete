import { createFileRoute } from "@tanstack/react-router";
import { AuthCodeErrorPage } from "./-components/auth-code-error-page";

export const Route = createFileRoute("/auth/auth-code-error")({
  component: AuthCodeErrorPage,
});
