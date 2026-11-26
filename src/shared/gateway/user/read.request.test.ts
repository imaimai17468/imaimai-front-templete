// @vitest-environment node

import { expect, layer } from "@effect/vitest";
import { Effect, Option } from "effect";
import { LocalBindings } from "@/test/local-bindings";
import { inRequest, SIGNED_OUT, signUp } from "@/test/local-request";
import { getCurrentUser } from "./read.ts";

const currentUser = Effect.promise(getCurrentUser);

const emailOf = (user: Awaited<ReturnType<typeof getCurrentUser>>) =>
  Option.map(Option.fromNullOr(user), ({ email }) => email);

layer(LocalBindings.layer, { timeout: 30_000 })(
  "getCurrentUser inside a real request",
  (it) => {
    it.effect(
      "should answer the signed-in account's own profile when the request carries its session cookie",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const user = yield* within(
            Effect.flatMap(signUp("reader@example.com"), (headers) =>
              inRequest(headers, currentUser)
            )
          );

          expect(emailOf(user)).toStrictEqual(
            Option.some("reader@example.com")
          );
        })
    );

    it.effect(
      "should answer no profile when the request carries no cookie",
      () =>
        Effect.gen(function* () {
          const { within } = yield* LocalBindings;

          const user = yield* within(inRequest(SIGNED_OUT, currentUser));

          expect(emailOf(user)).toStrictEqual(Option.none());
        })
    );
  }
);
