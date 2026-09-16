import { Context, Effect, Layer, Option } from "effect";
import { r2AvatarBucket } from "../avatar-bucket.live";

export interface AvatarObject {
  body: R2ObjectBody["body"];
  contentType: Option.Option<string>;
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
    readonly get: (key: string) => Effect.Effect<
      Option.Option<{
        body: R2ObjectBody["body"];
        httpMetadata?: { contentType?: string };
      }>
    >;
  }
>()("app/gateways/avatar/AvatarBucket") {
  static readonly layer = Layer.succeed(
    AvatarBucket,
    AvatarBucket.of({
      get: (key) =>
        Effect.promise(() => r2AvatarBucket.get(key)).pipe(
          Effect.map(Option.fromNullOr)
        ),
    })
  );
}

export class AvatarGateway extends Context.Service<
  AvatarGateway,
  {
    readonly fetchAvatar: (
      key: string
    ) => Effect.Effect<Option.Option<AvatarObject>>;
  }
>()("app/gateways/avatar/AvatarGateway") {
  static readonly layerNoDeps = Layer.effect(
    AvatarGateway,
    Effect.gen(function* buildAvatarGateway() {
      const bucket = yield* AvatarBucket;

      const fetchAvatar = Effect.fn("AvatarGateway.fetchAvatar")(
        function* fetchAvatar(key: string) {
          const object = yield* bucket.get(key);
          return object.pipe(
            Option.map((stored) => ({
              body: stored.body,
              contentType: Option.fromUndefinedOr(
                stored.httpMetadata?.contentType
              ),
            }))
          );
        }
      );

      return AvatarGateway.of({ fetchAvatar });
    })
  );

  static readonly layer = AvatarGateway.layerNoDeps.pipe(
    Layer.provide(AvatarBucket.layer)
  );
}
