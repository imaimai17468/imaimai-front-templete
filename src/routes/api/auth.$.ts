import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@/lib/auth/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => await getAuth().handler(request),
      POST: async ({ request }) => await getAuth().handler(request),
    },
  },
});
