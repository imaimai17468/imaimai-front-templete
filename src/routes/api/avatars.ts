import { createFileRoute } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { AvatarReader, runAvatarHandler } from "@/gateways/user/avatar/read";
import { avatarServedMime } from "@/lib/storage/avatar-validation";

const jsonError = (status: number, error: string): Response =>
  Response.json({ error }, { status });

export const getAvatarResponse: (
  request: Request
) => Effect.Effect<Response, never, AvatarReader> = Effect.fn(
  "getAvatarResponse"
)(
  function* readRequestedAvatar(request: Request) {
    const reader = yield* AvatarReader;
    return yield* reader.read(
      Option.fromNullOr(new URL(request.url).searchParams.get("key"))
    );
  },
  Effect.map(
    (avatar) =>
      new Response(avatar.body, {
        headers: {
          "Content-Type": avatarServedMime(avatar.contentType).pipe(
            Option.getOrElse(() => "image/png")
          ),
          // `private`: the response is session-gated — shared caches must
          // not store it (an edge/proxy hit would bypass the auth check).
          "Cache-Control": "private, max-age=31536000, immutable",
          // Uploads are MIME allow-listed, but never let a browser sniff or
          // script anything served from the bucket (stored-XSS hardening).
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'",
        },
      })
  ),
  Effect.catchTags({
    AvatarInvalidKey: () => Effect.succeed(jsonError(400, "Invalid key")),
    AvatarNotFound: () => Effect.succeed(jsonError(404, "Not found")),
    AvatarUnauthorized: () => Effect.succeed(jsonError(401, "Unauthorized")),
  })
);

export const Route = createFileRoute("/api/avatars")({
  server: {
    handlers: {
      GET: ({ request }) => runAvatarHandler(getAvatarResponse(request)),
    },
  },
});
