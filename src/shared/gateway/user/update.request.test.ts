// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { pngAvatarFile } from "@/test/avatar-files";
import { LocalBindings } from "@/test/local-bindings";
import { inRequest, SIGNED_OUT, signUp } from "@/test/local-request";
import { getCurrentUser } from "./read.ts";
import { updateProfile, uploadAvatar } from "./update.ts";
import type { UpdateProfileResult, UploadAvatarResult } from "./update.ts";

const currentUser = Effect.promise(getCurrentUser);

const rename = Effect.promise(() => updateProfile({ name: "Renamed" }));

layer(LocalBindings.layer, { timeout: 30_000 })(
  "the profile writes inside a real request",
  (it) => {
    it.effect(
      "should store the new name on the caller's row when the request carries their session cookie",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const { result, nameAfter } = yield* within(
            Effect.gen(function* () {
              const headers = yield* signUp("renamer@example.com");
              const answer = yield* inRequest(headers, rename);
              const after = yield* inRequest(headers, currentUser);
              return { nameAfter: after?.name, result: answer };
            })
          );

          expect({ nameAfter, result }).toStrictEqual({
            nameAfter: "Renamed",
            result: { status: "updated" },
          });
        })
    );

    it.effect(
      "should store the avatar and answer its URL when the request carries the caller's session cookie",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const { result, avatarUrlAfter } = yield* within(
            Effect.gen(function* () {
              const headers = yield* signUp("uploader@example.com");
              const answer = yield* inRequest(
                headers,
                Effect.promise(() => uploadAvatar(pngAvatarFile()))
              );
              const after = yield* inRequest(headers, currentUser);
              return { avatarUrlAfter: after?.avatarUrl, result: answer };
            })
          );

          expect(result).toStrictEqual({
            avatarUrl: avatarUrlAfter,
            cleanup: "complete",
            status: "uploaded",
          });
        })
    );

    it.effect.each([
      ["a name", rename],
      ["an avatar", Effect.promise(() => uploadAvatar(pngAvatarFile()))],
    ] satisfies [
      string,
      Effect.Effect<UpdateProfileResult | UploadAvatarResult>,
    ][])(
      "should refuse to write %s when the request carries no cookie",
      ([_label, write]) =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const result = yield* within(
            inRequest<UpdateProfileResult | UploadAvatarResult, never, never>(
              SIGNED_OUT,
              write
            )
          );

          expect(result).toStrictEqual({
            message: "Not authenticated",
            status: "failed",
          });
        })
    );
  }
);
