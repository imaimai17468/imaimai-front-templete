import "@tanstack/react-start/server-only";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { CurrentSession } from "@/lib/auth/session/current-session";
import { isOwnAvatarKey } from "@/lib/storage/avatar-validation";
import { makeRunHandler } from "../../runtime.ts";
import { orNone } from "../persistence.ts";
import { AvatarBucket } from "./bucket.ts";
import type { AvatarObject } from "./bucket.ts";

export class AvatarUnauthorized extends Schema.TaggedError<
  AvatarUnauthorized,
  { readonly brand: unique symbol }
>()("AvatarUnauthorized", {}) {}

export class AvatarInvalidKey extends Schema.TaggedError<
  AvatarInvalidKey,
  { readonly brand: unique symbol }
>()("AvatarInvalidKey", {}) {}

export class AvatarNotFound extends Schema.TaggedError<
  AvatarNotFound,
  { readonly brand: unique symbol }
>()("AvatarNotFound", {}) {}

/**
 * A bucket read that failed for a key the caller owns. It carries no fields,
 * so nothing of the bucket's error reaches whoever receives it.
 */
export class AvatarReadFailed extends Schema.TaggedError<
  AvatarReadFailed,
  { readonly brand: unique symbol }
>()("AvatarReadFailed", {}) {}

/**
 * The authorization boundary between an HTTP handler and the avatar bucket.
 *
 * Its dependencies are services rather than arguments, so a test provides a
 * layer instead of a session cookie and an R2 binding, and so the check itself
 * stays the only thing under test.
 */
export class AvatarReader extends Context.Service<
  AvatarReader,
  {
    readonly read: (
      key: Option.Option<string>
    ) => Effect.Effect<
      AvatarObject,
      AvatarInvalidKey | AvatarNotFound | AvatarReadFailed | AvatarUnauthorized
    >;
  }
>()("my-app/shared/gateway/user/avatar/read/AvatarReader") {
  static readonly layerNoDeps = Layer.effect(
    AvatarReader,
    Effect.gen(function* () {
      const currentSession = yield* CurrentSession;
      const bucket = yield* AvatarBucket;

      const read = Effect.fn("AvatarReader.read")(function* (
        key: Option.Option<string>
      ) {
        const caller = yield* currentSession.read;
        if (Option.isNone(caller)) {
          return yield* AvatarUnauthorized.make();
        }
        const ownKey = key.pipe(
          Option.filter((candidate) =>
            isOwnAvatarKey(candidate, caller.value.id)
          )
        );
        if (Option.isNone(ownKey)) {
          return yield* AvatarInvalidKey.make();
        }
        const answer = yield* orNone(
          "user.readAvatar",
          bucket.get(ownKey.value)
        );
        if (Option.isNone(answer)) {
          return yield* AvatarReadFailed.make();
        }
        const avatar = answer.value;
        if (Option.isNone(avatar)) {
          return yield* AvatarNotFound.make();
        }
        return avatar.value;
      });

      return AvatarReader.of({ read });
    })
  );

  static readonly layer = AvatarReader.layerNoDeps.pipe(
    Layer.provide(AvatarBucket.layer),
    Layer.provide(CurrentSession.layer)
  );
}

const jsonError = (status: number, error: string): Response =>
  Response.json({ error }, { status });

/**
 * The response to a request for the avatar its `key` query parameter names,
 * with every failure of the reader answered as a JSON error.
 */
export const getAvatarResponse: (
  request: Request
) => Effect.Effect<Response, never, AvatarReader> = Effect.fn(
  "getAvatarResponse"
)(
  function* (request: Request) {
    const reader = yield* AvatarReader;
    return yield* reader.read(
      Option.fromNullOr(new URL(request.url).searchParams.get("key"))
    );
  },
  Effect.map((avatar) => avatar.response()),
  Effect.catchTags({
    AvatarInvalidKey: () => Effect.succeed(jsonError(400, "Invalid key")),
    AvatarNotFound: () => Effect.succeed(jsonError(404, "Not found")),
    AvatarReadFailed: () =>
      Effect.succeed(jsonError(500, "Failed to read avatar")),
    AvatarUnauthorized: () => Effect.succeed(jsonError(401, "Unauthorized")),
  })
);

const runAvatarHandler = makeRunHandler(AvatarReader.layer);

/** `response` with its body dropped when it answers a HEAD. */
const answerForMethod = (method: string, response: Response): Response => {
  if (method === "HEAD") {
    return new Response("", response);
  }
  return response;
};

/**
 * Answers a request for an avatar object on behalf of the caller's session. A
 * HEAD gets the status and headers a GET would, without the body.
 */
export const serveAvatar = (request: Request): Promise<Response> =>
  runAvatarHandler(getAvatarResponse(request)).then((response) =>
    answerForMethod(request.method, response)
  );
