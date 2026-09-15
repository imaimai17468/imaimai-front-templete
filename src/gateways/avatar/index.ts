import { Context, Effect, Layer } from "effect";
import { r2AvatarBucket } from "../avatar-bucket.live";

export interface AvatarObject {
  body: R2ObjectBody["body"];
  contentType: string | null;
}

/**
 * The read side of the avatar bucket.
 *
 * The gateway is written against this service rather than against
 * `r2AvatarBucket`, so a test provides a fake layer without a Cloudflare
 * environment.
 */
export class AvatarBucket extends Context.Service<
  AvatarBucket,
  {
    readonly get: (key: string) => Effect.Effect<{
      body: R2ObjectBody["body"];
      httpMetadata?: { contentType?: string | undefined } | undefined;
    } | null>;
  }
>()("app/gateways/avatar/AvatarBucket") {
  static readonly layer = Layer.succeed(
    AvatarBucket,
    AvatarBucket.of({
      get: (key) => Effect.promise(async () => await r2AvatarBucket.get(key)),
    })
  );
}

export class AvatarGateway extends Context.Service<
  AvatarGateway,
  {
    readonly fetchAvatar: (key: string) => Effect.Effect<AvatarObject | null>;
  }
>()("app/gateways/avatar/AvatarGateway") {
  static readonly layerNoDeps = Layer.effect(
    AvatarGateway,
    Effect.gen(function* buildAvatarGateway() {
      const bucket = yield* AvatarBucket;

      const fetchAvatar = Effect.fn("AvatarGateway.fetchAvatar")(
        function* fetchAvatar(key: string) {
          const object = yield* bucket.get(key);
          if (object === null) {
            return null;
          }
          return {
            body: object.body,
            contentType: object.httpMetadata?.contentType ?? null,
          };
        }
      );

      return AvatarGateway.of({ fetchAvatar });
    })
  );

  static readonly layer = AvatarGateway.layerNoDeps.pipe(
    Layer.provide(AvatarBucket.layer)
  );
}
