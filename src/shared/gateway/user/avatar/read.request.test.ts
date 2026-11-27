// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { PNG_BYTES, pngAvatarFile } from "@/test/avatar-files";
import { LocalBindings } from "@/test/local-bindings";
import { inRequest, SIGNED_OUT, signUp } from "@/test/local-request";
import { uploadAvatar } from "../update.ts";
import { serveAvatar } from "./read.ts";

const served = (headers: HeadersInit, avatarUrl: string, method: string) =>
  inRequest(
    headers,
    Effect.promise(() =>
      serveAvatar(
        new Request(new URL(avatarUrl, "http://localhost"), {
          headers,
          method,
        })
      )
    )
  ).pipe(
    Effect.flatMap((response) =>
      Effect.promise(() => response.arrayBuffer()).pipe(
        Effect.map((body) => ({
          body: [...new Uint8Array(body)],
          contentType: response.headers.get("content-type"),
          status: response.status,
        }))
      )
    )
  );

/** Signs up an account, uploads its avatar, and requests it with `method`. */
const servedOwnAvatar = (email: string, method: string) =>
  Effect.gen(function* () {
    const headers = yield* signUp(email);
    const upload = yield* inRequest(
      headers,
      Effect.promise(() => uploadAvatar({ data: { avatar: pngAvatarFile() } }))
    );
    if (upload.status !== "uploaded") {
      return yield* Effect.die(upload);
    }
    return yield* served(headers, upload.avatarUrl, method);
  });

layer(LocalBindings.layer, { timeout: 30_000 })(
  "serveAvatar inside a real request",
  (it) => {
    it.effect(
      "should serve the caller's own avatar bytes when the request carries their session cookie",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const response = yield* within(
            servedOwnAvatar("viewer@example.com", "GET")
          );

          expect(response).toStrictEqual({
            body: PNG_BYTES,
            contentType: "image/png",
            status: 200,
          });
        })
    );

    it.effect("should answer 401 when the request carries no cookie", () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;

        const response = yield* within(
          served(SIGNED_OUT, "/api/avatars?key=someone/avatar.png", "GET")
        );

        expect(response.status).toBe(401);
      })
    );
  }
);
