import "@tanstack/react-start/server-only";
import { Context, Effect, Layer, Option } from "effect";
import { getCloudflareEnv } from "@/lib/cloudflare/env.live";
import { persistenceEffect } from "..";
import type { UserPersistenceError } from "..";

export interface AvatarObject {
  readonly body: R2ObjectBody["body"];
  readonly contentType: Option.Option<string>;
}

/**
 * The stored object as this gateway hands it on.
 *
 * R2 reports a missing content type as an absent property, and the route that
 * serves the object picks its own default, so the absence has to survive as an
 * `Option` rather than become one here.
 */
export const avatarObjectFrom = (stored: {
  body: R2ObjectBody["body"];
  httpMetadata?: { contentType?: string };
}): AvatarObject => ({
  body: stored.body,
  contentType: Option.fromUndefinedOr(stored.httpMetadata?.contentType),
});

/**
 * The `AVATARS_BUCKET` binding, reached by key.
 *
 * A service rather than direct binding calls so a test provides a bucket
 * without a Cloudflare environment. `put` reports only whether the object was
 * written, because the URL that addresses it is derived from the key by
 * `avatarUrlForKey`.
 */
export class AvatarBucket extends Context.Service<
  AvatarBucket,
  {
    readonly get: (key: string) => Effect.Effect<Option.Option<AvatarObject>>;
    readonly put: (
      key: string,
      file: File | ArrayBuffer,
      contentType: string
    ) => Effect.Effect<void, UserPersistenceError>;
    readonly remove: (key: string) => Effect.Effect<void, UserPersistenceError>;
  }
>()("app/gateways/user/avatar/AvatarBucket") {
  static readonly layer = Layer.succeed(
    AvatarBucket,
    AvatarBucket.of({
      get: (key) =>
        Effect.promise(() => getCloudflareEnv().AVATARS_BUCKET.get(key)).pipe(
          Effect.map((stored) =>
            Option.fromNullOr(stored).pipe(Option.map(avatarObjectFrom))
          )
        ),
      put: (key, file, contentType) =>
        persistenceEffect(() =>
          getCloudflareEnv().AVATARS_BUCKET.put(key, file, {
            httpMetadata: { contentType },
          })
        ).pipe(Effect.asVoid),
      remove: (key) =>
        persistenceEffect(() => getCloudflareEnv().AVATARS_BUCKET.delete(key)),
    })
  );
}

/**
 * The identifier that makes a new avatar key unique.
 *
 * A service rather than a direct `crypto.randomUUID()` call so a test fixes the
 * key the upload writes. The value has to be unguessable because it names a
 * bucket object, and `crypto` crosses no further than this layer.
 */
export class AvatarKeyIds extends Context.Service<
  AvatarKeyIds,
  { readonly next: Effect.Effect<string> }
>()("app/gateways/user/avatar/AvatarKeyIds") {
  static readonly layer = Layer.succeed(
    AvatarKeyIds,
    AvatarKeyIds.of({ next: Effect.sync(() => crypto.randomUUID()) })
  );
}
