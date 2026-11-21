import "@tanstack/react-start/server-only";
import { Context, Effect, Layer, Option } from "effect";
import { SecureRandom } from "effect/crypto";
import { storage } from "void/storage";
import { avatarContentTypeForKey } from "@/lib/storage/avatar-validation";
import type { AvatarContentType } from "@/lib/storage/avatar-validation";
import { persistenceEffect } from "../persistence.ts";
import type { UserPersistenceError } from "../persistence.ts";

/**
 * An avatar object as it leaves the bucket.
 *
 * The bytes are private, and `response()` is the only way to them, so a route
 * that serves an avatar cannot leave out the headers that keep uploaded bytes
 * inert. The bytes can be anything the bucket holds, HTML after an image
 * signature included; the fixed image type and `nosniff` keep a browser from
 * treating them as a document, and `default-src 'none'` keeps anything it does render from
 * loading or running a resource. `private` keeps a shared cache from storing a
 * response the session check gated.
 */
export class AvatarObject {
  readonly #body: R2ObjectBody["body"];
  readonly #contentType: AvatarContentType;

  constructor(body: R2ObjectBody["body"], contentType: AvatarContentType) {
    this.#body = body;
    this.#contentType = contentType;
  }

  response(): Response {
    return new Response(this.#body, {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'",
        "Content-Type": this.#contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}

/**
 * The object stored under `key`, typed by the key's extension, or `None` for a
 * key no avatar is served under. What R2 recorded as the content type is not
 * read.
 */
export const avatarObjectFrom = (
  key: string,
  body: R2ObjectBody["body"]
): Option.Option<AvatarObject> =>
  avatarContentTypeForKey(key).pipe(
    Option.map((contentType) => new AvatarObject(body, contentType))
  );

/**
 * The R2 bucket `void/storage` binds, reached by key.
 *
 * A service rather than direct binding calls so a test provides a bucket
 * without a Cloudflare environment. `put` reports only whether the object was
 * written, because the URL that addresses it is derived from the key by
 * `avatarUrlForKey`.
 */
export class AvatarBucket extends Context.Service<
  AvatarBucket,
  {
    readonly get: (
      key: string
    ) => Effect.Effect<Option.Option<AvatarObject>, UserPersistenceError>;
    readonly put: (
      key: string,
      file: File | ArrayBuffer,
      contentType: string
    ) => Effect.Effect<void, UserPersistenceError>;
    readonly remove: (key: string) => Effect.Effect<void, UserPersistenceError>;
  }
>()("my-app/shared/gateway/user/avatar/bucket/AvatarBucket") {
  static readonly layer = Layer.succeed(
    AvatarBucket,
    AvatarBucket.of({
      get: (key) =>
        persistenceEffect(() => storage.get(key)).pipe(
          Effect.map((stored) =>
            Option.fromNullOr(stored).pipe(
              Option.flatMap(({ body }) => avatarObjectFrom(key, body))
            )
          )
        ),
      put: (key, file, contentType) =>
        persistenceEffect(() =>
          storage.put(key, file, {
            httpMetadata: { contentType },
          })
        ).pipe(Effect.asVoid),
      remove: (key) => persistenceEffect(() => storage.delete(key)),
    })
  );
}

/**
 * The identifier that makes a new avatar key unique.
 *
 * A service rather than a direct call to Web Crypto so a test fixes the
 * key the upload writes. The value has to be unguessable because it names a
 * bucket object, and `crypto` crosses no further than this layer.
 */
export class AvatarKeyIds extends Context.Service<
  AvatarKeyIds,
  { readonly next: Effect.Effect<string> }
>()("my-app/shared/gateway/user/avatar/bucket/AvatarKeyIds") {
  static readonly layer = Layer.effect(
    AvatarKeyIds,
    Effect.gen(function* buildAvatarKeyIds() {
      const random = yield* SecureRandom.SecureRandom;
      return AvatarKeyIds.of({ next: random.uuidV4() });
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto));
}
