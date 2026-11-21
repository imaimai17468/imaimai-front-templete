import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "./-components/login-page.tsx";
import { LoginSearchSchema } from "./-entities/login-search.ts";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: LoginSearchSchema,
});
