import { createFileRoute } from "@tanstack/react-router";
import { serveAvatar } from "@/shared/gateway/user/avatar/read";

export const Route = createFileRoute("/api/avatars")({
  server: {
    handlers: {
      GET: ({ request }) => serveAvatar(request),
    },
  },
});
