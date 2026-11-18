import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "./-components/login-page";
import { LoginSearchSchema } from "./-entities/login-search";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: LoginSearchSchema,
});
