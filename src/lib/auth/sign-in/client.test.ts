import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Option } from "effect";
import type { MemoryAuth } from "@/test/auth-server";
import { connectBrowserTo, buildMemoryAuth } from "@/test/auth-server";

const importClient = () => import("./client.ts");

/**
 * Better Auth's client keeps the `fetch` it found when it was created, so the
 * module is evaluated again after `fetch` was routed to `auth`.
 */
const loadClientAgainst = (auth: MemoryAuth) => {
  const browser = connectBrowserTo(auth);
  vi.spyOn(globalThis, "fetch").mockImplementation(browser.fetch);
  vi.resetModules();
  return Effect.promise(importClient).pipe(
    Effect.map((client) => ({ browser, client }))
  );
};

const ACCOUNT = {
  email: "client@example.com",
  name: "Client",
  password: "client-password",
};

describe("auth client calls", () => {
  it.effect(
    "should report the server's message when the sign-in names no account",
    () =>
      Effect.gen(function* () {
        const { client } = yield* loadClientAgainst(buildMemoryAuth(true));

        const failure = yield* Effect.promise(() =>
          client.signInWithEmail({
            email: ACCOUNT.email,
            password: ACCOUNT.password,
          })
        );

        expect(failure).toStrictEqual(
          Option.some({ message: Option.some("Invalid email or password") })
        );
      })
  );

  it.effect(
    "should report no failure when the sign-up creates the account",
    () =>
      Effect.gen(function* () {
        const { client } = yield* loadClientAgainst(buildMemoryAuth(true));

        const failure = yield* Effect.promise(() =>
          client.signUpWithEmail(ACCOUNT)
        );

        expect(failure).toStrictEqual(Option.none());
      })
  );

  it.effect(
    "should ask the server for Google, returning to / and to /login on an error, when Google sign-in starts",
    () =>
      Effect.gen(function* () {
        const { browser, client } = yield* loadClientAgainst(
          buildMemoryAuth(false)
        );

        const failure = yield* Effect.promise(() => client.startGoogleSignIn());
        const bodies = yield* Effect.forEach(
          browser.sent(),
          (request) => Effect.promise(() => request.json()),
          { concurrency: 1 }
        );

        expect({ bodies, failure }).toStrictEqual({
          bodies: [
            {
              callbackURL: "/",
              errorCallbackURL: "/login",
              provider: "google",
            },
          ],
          failure: Option.none(),
        });
      })
  );

  it.effect(
    "should revoke the session the browser held when the session ends",
    () =>
      Effect.gen(function* () {
        const auth = buildMemoryAuth(true);
        const { browser, client } = yield* loadClientAgainst(auth);
        yield* Effect.promise(() => client.signUpWithEmail(ACCOUNT));
        const heldCookie = browser.cookie();

        yield* Effect.promise(() => client.endSession());
        const session = yield* Effect.promise(() =>
          auth.api.getSession({ headers: new Headers({ cookie: heldCookie }) })
        );

        expect(session).toBeNull();
      })
  );
});
