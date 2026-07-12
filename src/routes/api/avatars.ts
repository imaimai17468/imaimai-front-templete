import { createFileRoute } from "@tanstack/react-router";
import { getSession } from "@/lib/auth/session";
import { isOwnAvatarKey } from "@/lib/storage/avatar-validation";
import { getCloudflareEnv } from "@/server/cloudflare";

export const Route = createFileRoute("/api/avatars")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await getSession();
        if (!session?.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        if (!key || !isOwnAvatarKey(key, session.user.id)) {
          return Response.json({ error: "Invalid key" }, { status: 400 });
        }

        const object = await getCloudflareEnv().AVATARS_BUCKET.get(key);
        if (!object) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }

        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType ?? "image/png",
            // `private`: the response is session-gated — shared caches must
            // not store it (an edge/proxy hit would bypass the auth check).
            "Cache-Control": "private, max-age=31536000, immutable",
            // Uploads are MIME allow-listed, but never let a browser sniff or
            // script anything served from the bucket (stored-XSS hardening).
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
          },
        });
      },
    },
  },
});
