// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { storage } from "void/storage";
import { LocalBindings } from "@/test/local-bindings";
import { persistenceEffect } from "../persistence.ts";
import type { AvatarObject } from "./bucket.ts";
import { AvatarBucket, AvatarKeyIds } from "./bucket.ts";

const AVATAR_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

const UUID_V4 =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/u;

const avatarKey = (id: string, extension: string) =>
  `user-1/avatars/${id}.${extension}`;

const servedBytes = (avatar: AvatarObject) => {
  const response = avatar.response();
  return Effect.promise(() => response.arrayBuffer()).pipe(
    Effect.map((body) => ({
      body: new Uint8Array(body),
      contentType: response.headers.get("Content-Type"),
    }))
  );
};

layer(Layer.mergeAll(LocalBindings.layer, AvatarBucket.layer), {
  timeout: 30_000,
})("AvatarBucket against a local R2", (it) => {
  it.effect(
    "should serve the stored bytes as the type the key names, whatever type the put recorded",
    () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;
        const bucket = yield* AvatarBucket;
        const key = avatarKey("123e4567-e89b-42d3-a456-426614174000", "webp");

        const served = yield* within(
          bucket.put(key, AVATAR_BYTES.buffer, "image/png").pipe(
            Effect.andThen(bucket.get(key)),
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeedNone,
                onSome: (avatar) => Effect.asSome(servedBytes(avatar)),
              })
            )
          )
        );

        expect(served).toStrictEqual(
          Option.some({ body: AVATAR_BYTES, contentType: "image/webp" })
        );
      })
  );

  it.effect(
    "should record the content type the caller passed when an avatar is put",
    () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;
        const bucket = yield* AvatarBucket;
        const key = avatarKey("123e4567-e89b-42d3-a456-426614174001", "png");

        const recorded = yield* within(
          bucket.put(key, AVATAR_BYTES.buffer, "image/png").pipe(
            Effect.andThen(persistenceEffect(() => storage.head(key))),
            Effect.map((object) => object?.httpMetadata?.contentType)
          )
        );

        expect(recorded).toBe("image/png");
      })
  );

  it.effect("should serve nothing when no object is stored under the key", () =>
    Effect.gen(function* () {
      const { within } = yield* LocalBindings;
      const bucket = yield* AvatarBucket;

      const served = yield* within(
        bucket.get(avatarKey("123e4567-e89b-42d3-a456-426614174002", "png"))
      );

      expect(served).toStrictEqual(Option.none());
    })
  );

  it.effect("should serve nothing once a stored key was removed", () =>
    Effect.gen(function* () {
      const { within } = yield* LocalBindings;
      const bucket = yield* AvatarBucket;
      const key = avatarKey("123e4567-e89b-42d3-a456-426614174003", "png");

      const presence = yield* within(
        Effect.gen(function* () {
          yield* bucket.put(key, AVATAR_BYTES.buffer, "image/png");
          const stored = yield* bucket.get(key);
          yield* bucket.remove(key);
          const removed = yield* bucket.get(key);
          return {
            afterRemoval: Option.isSome(removed),
            beforeRemoval: Option.isSome(stored),
          };
        })
      );

      expect(presence).toStrictEqual({
        afterRemoval: false,
        beforeRemoval: true,
      });
    })
  );
});

layer(AvatarKeyIds.layer)("AvatarKeyIds.layer", (it) => {
  it.effect("should draw a different UUID v4 each time a key is made", () =>
    Effect.gen(function* () {
      const ids = yield* AvatarKeyIds;

      const first = yield* ids.next;
      const second = yield* ids.next;

      expect({
        distinct: first !== second,
        firstIsUuidV4: UUID_V4.test(first),
        secondIsUuidV4: UUID_V4.test(second),
      }).toStrictEqual({
        distinct: true,
        firstIsUuidV4: true,
        secondIsUuidV4: true,
      });
    })
  );
});
