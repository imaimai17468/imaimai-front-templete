import { readAvatarForCurrentUser } from "@/server/fn/avatar";

export const getAvatarResponse = async (
  request: Request
): Promise<Response> => {
  const url = new URL(request.url);
  const result = await readAvatarForCurrentUser(url.searchParams.get("key"));
  switch (result.kind) {
    case "unauthorized":
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    case "invalid-key":
      return Response.json({ error: "Invalid key" }, { status: 400 });
    case "not-found":
      return Response.json({ error: "Not found" }, { status: 404 });
    case "found":
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
  const exhaustiveResult: never = result;
  return exhaustiveResult;
};
