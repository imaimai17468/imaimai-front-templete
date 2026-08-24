import { createFileRoute } from "@tanstack/react-router";
import { readAvatarForCurrentUser } from "@/server/fn/avatar";
import type { AvatarReadResult } from "@/server/fn/avatar";

/**
 * The authorization check this handler turns into an HTTP response.
 *
 * Injected so a test drives every response branch without a session or a
 * bucket, and so the handler stays the only thing under test.
 */
export type AvatarReader = (key: string | null) => Promise<AvatarReadResult>;

export const createGetAvatarResponse =
  (readAvatar: AvatarReader) =>
  async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const result = await readAvatar(url.searchParams.get("key"));
    switch (result.kind) {
      case "unauthorized": {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      case "invalid-key": {
        return Response.json({ error: "Invalid key" }, { status: 400 });
      }
      case "not-found": {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
      case "found": {
        return new Response(result.avatar.body, {
          headers: {
            "Content-Type": result.avatar.contentType ?? "image/png",
            // `private`: the response is session-gated — shared caches must
            // not store it (an edge/proxy hit would bypass the auth check).
            "Cache-Control": "private, max-age=31536000, immutable",
            // Uploads are MIME allow-listed, but never let a browser sniff or
            // script anything served from the bucket (stored-XSS hardening).
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
          },
        });
      }
      // A new result kind fails to compile here rather than falling through to
      // a response nobody chose, because it has no `never` to widen into.
      default: {
        const unhandled: never = result;
        throw new Error(`Unhandled avatar read result: ${String(unhandled)}`);
      }
    }
  };

export const getAvatarResponse = createGetAvatarResponse(
  readAvatarForCurrentUser
);

export const Route = createFileRoute("/api/avatars")({
  server: {
    handlers: {
      GET: async ({ request }) => await getAvatarResponse(request),
    },
  },
});
