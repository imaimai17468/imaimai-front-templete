import { Context, Effect, Layer, Schema } from "effect";
import { CurrentSession } from "@/lib/auth/current-session.live";
import { isOwnAvatarKey } from "@/lib/storage/avatar-validation";
import { AvatarGateway } from ".";
import type { AvatarObject } from ".";
import { makeRunHandler } from "../runtime.live";

export class AvatarUnauthorized extends Schema.TaggedError<AvatarUnauthorized>()(
  "AvatarUnauthorized",
  {}
) {}

export class AvatarInvalidKey extends Schema.TaggedError<AvatarInvalidKey>()(
  "AvatarInvalidKey",
  {}
) {}

export class AvatarNotFound extends Schema.TaggedError<AvatarNotFound>()(
  "AvatarNotFound",
  {}
) {}

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
      key: string | null
    ) => Effect.Effect<
      AvatarObject,
      AvatarInvalidKey | AvatarNotFound | AvatarUnauthorized
    >;
  }
>()("app/gateways/avatar/AvatarReader") {
  static readonly layerNoDeps = Layer.effect(
    AvatarReader,
    Effect.gen(function* buildAvatarReader() {
      const currentSession = yield* CurrentSession;
      const gateway = yield* AvatarGateway;

      const read = Effect.fn("AvatarReader.read")(function* read(
        key: string | null
      ) {
        const session = yield* currentSession.read;
        if (!session?.user) {
          return yield* new AvatarUnauthorized();
        }
        if (key === null || !isOwnAvatarKey(key, session.user.id)) {
          return yield* new AvatarInvalidKey();
        }
        const avatar = yield* gateway.fetchAvatar(key);
        if (avatar === null) {
          return yield* new AvatarNotFound();
        }
        return avatar;
      });

      return AvatarReader.of({ read });
    })
  );

  static readonly layer = AvatarReader.layerNoDeps.pipe(
    Layer.provide(AvatarGateway.layer),
    Layer.provide(CurrentSession.layer)
  );
}

export const runAvatarHandler = makeRunHandler(AvatarReader.layer);
