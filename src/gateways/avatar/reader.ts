import "@tanstack/react-start/server-only";
import { Context, Effect, Layer, Option, Schema } from "effect";
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
      key: Option.Option<string>
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
        key: Option.Option<string>
      ) {
        const caller = yield* currentSession.read;
        if (Option.isNone(caller)) {
          return yield* new AvatarUnauthorized();
        }
        const ownKey = key.pipe(
          Option.filter((candidate) =>
            isOwnAvatarKey(candidate, caller.value.id)
          )
        );
        if (Option.isNone(ownKey)) {
          return yield* new AvatarInvalidKey();
        }
        const avatar = yield* gateway.fetchAvatar(ownKey.value);
        if (Option.isNone(avatar)) {
          return yield* new AvatarNotFound();
        }
        return avatar.value;
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
