// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { PNG_BYTES, pngAvatarFile } from "@/test/avatar-files";
import { LocalBindings } from "@/test/local-bindings";
import { inRequest, SIGNED_OUT, signUp } from "@/test/local-request";
import { uploadAvatar } from "../update.ts";
import { serveAvatar } from "./read.ts";

const served = (headers: HeadersInit, avatarUrl: string) =>
  inRequest(
    headers,
    Effect.promise(() =>
      serveAvatar(
        new Request(new URL(avatarUrl, "http://localhost"), { headers })
      )
    )
  ).pipe(
    Effect.flatMap((response) =>
      Effect.promise(() => response.arrayBuffer()).pipe(
        Effect.map((body) => ({
          body: [...new Uint8Array(body)],
          status: response.status,
        }))
      )
    )
  );

layer(LocalBindings.layer, { timeout: 30_000 })(
  "serveAvatar inside a real request",
  (it) => {
    it.effect(
      "should serve the caller's own avatar bytes when the request carries their session cookie",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const response = yield* within(
            Effect.gen(function* () {
              const headers = yield* signUp("viewer@example.com");
              const upload = yield* inRequest(
                headers,
                Effect.promise(() =>
                  uploadAvatar({ data: { avatar: pngAvatarFile() } })
                )
              );
              if (upload.status !== "uploaded") {
                return yield* Effect.die(upload);
              }
              return yield* served(headers, upload.avatarUrl);
            })
          );

          expect(response).toStrictEqual({ body: PNG_BYTES, status: 200 });
        })
    );

    it.effect("should answer 401 when the request carries no cookie", () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;

        const response = yield* within(
          served(SIGNED_OUT, "/api/avatars?key=someone/avatar.png")
        );

        expect(response.status).toBe(401);
      })
    );
  }
);
