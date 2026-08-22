import { createFileRoute } from "@tanstack/react-router";
import { app } from "@/server/app";

// Everything under /api/* belongs to the Hono app. This file only forwards, so
// adding an endpoint means editing src/server/app.ts and nothing here.
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: async ({ request }) => app.fetch(request),
    },
  },
});
