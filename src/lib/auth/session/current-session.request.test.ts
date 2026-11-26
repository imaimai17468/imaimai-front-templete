// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect, Option } from "effect";
import { LocalBindings } from "@/test/local-bindings";
import { inRequest, SIGNED_OUT, signUp } from "@/test/local-request";
import { CurrentSession } from "./current-session.ts";

const readSessionEmail = Effect.gen(function* () {
  const session = yield* CurrentSession;
  const caller = yield* session.read;
  return caller.pipe(Option.map(({ email }) => email));
}).pipe(Effect.provide(CurrentSession.layer));

layer(LocalBindings.layer, { timeout: 30_000 })(
  "CurrentSession read from a real request",
  (it) => {
    it.effect(
      "should read the signed-in account when the request carries its session cookie",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const email = yield* within(
            Effect.flatMap(signUp("session@example.com"), (headers) =>
              inRequest(headers, readSessionEmail)
            )
          );

          expect(email).toStrictEqual(Option.some("session@example.com"));
        })
    );

    it.effect("should read no caller when the request carries no cookie", () =>
      Effect.gen(function* () {
        const { within } = yield* LocalBindings;

        const email = yield* within(inRequest(SIGNED_OUT, readSessionEmail));

        expect(email).toStrictEqual(Option.none());
      })
    );
  }
);
