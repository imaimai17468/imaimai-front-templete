import { createServerEntry } from "@tanstack/react-start/server";
import { Array, Deferred, Effect, Option, pipe, String } from "effect";
import type { Exit } from "effect";
import { getAuth } from "@/lib/auth/better-auth";

const ORIGIN = "http://localhost";

/** The `Cookie` header a browser sends back after receiving `setCookies`. */
export const cookieHeaderFrom = (setCookies: readonly string[]): string =>
  pipe(
    setCookies,
    Array.map((setCookie) => String.split(setCookie, ";")[0]),
    Array.join("; ")
  );

/** The headers of a request no session cookie rides on. */
export const SIGNED_OUT: HeadersInit = {};

/**
 * Registers an email and password account through Better Auth and answers the
 * `Cookie` header its session travels in, so a request carrying it is read as
 * that account's. Run it inside `LocalBindings.within`, whose D1 holds the row.
 */
export const signUp = (email: string): Effect.Effect<HeadersInit> =>
  Effect.promise(() =>
    getAuth().api.signUpEmail({
      body: { email, name: email, password: "local-request-password" },
      returnHeaders: true,
    })
  ).pipe(
    Effect.map(({ headers }) => ({
      cookie: cookieHeaderFrom(headers.getSetCookie()),
    }))
  );

/** The response a request handler answered with, whether or not it awaited. */
const settled = (
  answer: Promise<Response> | Response
): Effect.Effect<Response> => {
  if (answer instanceof Response) {
    return Effect.succeed(answer);
  }
  return Effect.promise(() => answer);
};

/**
 * Runs `effect` inside a TanStack Start request carrying `headers`, so the
 * request it reads through `getRequest()` is that one.
 */
export const inRequest = <A, E, R>(
  headers: HeadersInit,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const context = yield* Effect.context<R>();
    const outcome = yield* Deferred.make<Exit.Exit<A, E>>();
    const run = Effect.runPromiseExitWith(context);
    const response = yield* Effect.callback<Response>((resume, signal) => {
      const answer = createServerEntry({
        fetch: () =>
          run(effect, { signal })
            .then((exit) => run(Deferred.succeed(outcome, exit)))
            .then(() => new Response()),
      }).fetch(new Request(ORIGIN, { headers }), {});
      resume(settled(answer));
    });
    const exit = yield* Deferred.poll(outcome);
    if (Option.isNone(exit)) {
      return yield* Effect.die(
        `the request handler never ran (status ${response.status})`
      );
    }
    return yield* Effect.flatten(exit.value);
  });
