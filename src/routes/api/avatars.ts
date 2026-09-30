import { createFileRoute } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import {
  AvatarReader,
  runAvatarHandler,
} from "@/shared/gateway/user/avatar/read";

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
  Effect.map((avatar) => avatar.response()),
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
