// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { env } from "void/env";
import { LocalBindings } from "@/test/local-bindings";
import { signUp } from "@/test/local-request";
import { isCookieSignedWith } from "@/test/signed-cookie";
import { getAuth } from "./better-auth.ts";

layer(LocalBindings.layer, { timeout: 30_000 })(
  "getAuth against a local D1",
  (it) => {
    it.effect(
      "should sign the session cookie with BETTER_AUTH_SECRET when an account signs up",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const signed = yield* within(
            signUp("secret@example.com").pipe(
              Effect.flatMap((headers) =>
                isCookieSignedWith(
                  new Headers(headers).get("cookie") ?? "",
                  "better-auth.session_token",
                  env.BETTER_AUTH_SECRET
                )
              )
            )
          );

          expect(signed).toBeTruthy();
        })
    );

    it.effect(
      "should send GOOGLE_CLIENT_ID to Google's consent page when Google sign-in starts",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const clientId = yield* within(
            Effect.promise(() =>
              getAuth().api.signInSocial({
                body: { callbackURL: "/", provider: "google" },
              })
            ).pipe(
              Effect.map(({ url }) => ({
                expected: env.GOOGLE_CLIENT_ID,
                sent: new URL(url ?? "").searchParams.get("client_id"),
              }))
            )
          );

          expect(clientId.sent).toBe(clientId.expected);
        })
    );
  }
);
