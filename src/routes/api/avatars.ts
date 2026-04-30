import { createFileRoute } from "@tanstack/react-router";
import { getCloudflareEnv } from "@/server/cloudflare";

export const Route = createFileRoute("/api/avatars")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        if (!key) {
          return Response.json({ error: "Missing key" }, { status: 400 });
        }

        const object = await getCloudflareEnv().AVATARS_BUCKET.get(key);
        if (!object) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }

        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType ?? "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
