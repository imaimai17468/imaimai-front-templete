import { createFileRoute } from "@tanstack/react-router";
import { ProfileGate } from "./-components/profile-gate";

export const Route = createFileRoute("/_authed/profile")({
  component: ProfileGate,
});
