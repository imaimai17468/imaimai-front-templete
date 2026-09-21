import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "./-components/login-page";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
