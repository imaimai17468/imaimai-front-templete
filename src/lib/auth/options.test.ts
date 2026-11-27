import { describe, expect, it, vi } from "@effect/vitest";
import { Array, Effect, Option, pipe, String } from "effect";
import type { MemoryAuth } from "@/test/auth-server";
import { AUTH_SERVER_SECRETS, buildMemoryAuth } from "@/test/auth-server";
import { cookieHeaderFrom } from "@/test/local-request";
import { isCookieSignedWith } from "@/test/signed-cookie";
import { authOptions } from "./options.ts";

interface SignInAttempt {
  readonly cfConnectingIp: string;
  readonly xForwardedFor: string;
}

const SIGN_IN_BODY =
  '{"email":"probe@example.com","password":"wrong-password"}';

const signInRequest = ({ cfConnectingIp, xForwardedFor }: SignInAttempt) =>
  new Request("http://localhost/api/auth/sign-in/email", {
    body: SIGN_IN_BODY,
    headers: {
      "cf-connecting-ip": cfConnectingIp,
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-for": xForwardedFor,
    },
    method: "POST",
  });

/** Sends the attempts one after another, because the limiter counts them in arrival order. */
const signInStatuses = (auth: MemoryAuth, attempts: readonly SignInAttempt[]) =>
  Effect.forEach(
    attempts,
    (attempt) =>
      Effect.promise(() => auth.handler(signInRequest(attempt))).pipe(
        Effect.map((response) => response.status)
      ),
    { concurrency: 1 }
  );

const startGoogleSignIn = (auth: MemoryAuth) =>
  Effect.promise(() =>
    auth.api.signInSocial({
      body: { callbackURL: "/", provider: "google" },
      returnHeaders: true,
    })
  );

const carriesSecure = (setCookie: string) =>
  pipe(
    String.split(setCookie, ";"),
    Array.some(
      (attribute) => String.toLowerCase(String.trim(attribute)) === "secure"
    )
  );

/** The `Cookie` header a browser sends back after a sign-up's `Set-Cookie`. */
const signUpForCookieHeader = (auth: MemoryAuth) =>
  Effect.promise(() =>
    auth.api.signUpEmail({
      body: {
        email: "lifetime@example.com",
        name: "Lifetime",
        password: "lifetime-password",
      },
      returnHeaders: true,
    })
  ).pipe(Effect.map(({ headers }) => cookieHeaderFrom(headers.getSetCookie())));

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const SIGNED_UP_AT = 1_767_225_600_000;

/**
 * Signs up at `SIGNED_UP_AT` and reads the session back `elapsed` later, with
 * only `Date` faked so Better Auth's promises still settle.
 */
const readSessionExpiryAfter = (elapsed: number) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(SIGNED_UP_AT);
    }),
    () =>
      Effect.gen(function* () {
        const auth = buildMemoryAuth(true);
        const cookie = yield* signUpForCookieHeader(auth);
        vi.setSystemTime(SIGNED_UP_AT + elapsed);
        const read = yield* Effect.promise(() =>
          auth.api.getSession({ headers: new Headers({ cookie }) })
        );
        return Option.fromNullOr(read).pipe(
          Option.map(({ session }) => session.expiresAt.getTime())
        );
      }),
    () => Effect.sync(() => vi.useRealTimers())
  );

describe(authOptions, () => {
  it.each([
    { build: "dev", isDevBuild: true },
    { build: "production", isDevBuild: false },
  ])(
    "should enable database-backed rate limiting when the $build build runs without NODE_ENV=production",
    ({ isDevBuild }) =>
      buildMemoryAuth(isDevBuild).$context.then(({ rateLimit }) => {
        expect({
          enabled: rateLimit.enabled,
          storage: rateLimit.storage,
        }).toStrictEqual({ enabled: true, storage: "database" });
      })
  );

  it.effect(
    "should answer 429 to the fourth sign-in within ten seconds when cf-connecting-ip stays the same and x-forwarded-for changes",
    () =>
      Effect.gen(function* () {
        const statuses = yield* signInStatuses(
          buildMemoryAuth(false),
          Array.map(
            ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"],
            (xForwardedFor) => ({
              cfConnectingIp: "203.0.113.7",
              xForwardedFor,
            })
          )
        );

        expect(statuses).toStrictEqual([400, 400, 400, 429]);
      })
  );

  it.effect(
    "should count a sign-in in its own bucket when it comes from another cf-connecting-ip",
    () =>
      Effect.gen(function* () {
        const statuses = yield* signInStatuses(buildMemoryAuth(false), [
          { cfConnectingIp: "203.0.113.7", xForwardedFor: "198.51.100.1" },
          { cfConnectingIp: "203.0.113.7", xForwardedFor: "198.51.100.1" },
          { cfConnectingIp: "203.0.113.7", xForwardedFor: "198.51.100.1" },
          { cfConnectingIp: "203.0.113.8", xForwardedFor: "198.51.100.1" },
        ]);

        expect(statuses).toStrictEqual([400, 400, 400, 400]);
      })
  );

  it.effect.each([
    { build: "dev", isDevBuild: true, secure: false },
    { build: "production", isDevBuild: false, secure: true },
  ])(
    "should set Secure on its cookies exactly when the build is not a dev build ($build)",
    ({ isDevBuild, secure }) =>
      Effect.gen(function* () {
        const { headers } = yield* startGoogleSignIn(
          buildMemoryAuth(isDevBuild)
        );

        expect(
          Array.dedupe(Array.map(headers.getSetCookie(), carriesSecure))
        ).toStrictEqual([secure]);
      })
  );

  it.effect(
    "should sign the session cookie with the secret it was handed when an account signs up",
    () =>
      Effect.gen(function* () {
        const cookie = yield* signUpForCookieHeader(buildMemoryAuth(true));

        const signed = yield* isCookieSignedWith(
          cookie,
          "better-auth.session_token",
          AUTH_SERVER_SECRETS.authSecret
        );

        expect(signed).toBeTruthy();
      })
  );

  it.effect(
    "should keep a session for seven days when nothing reads it in between",
    () =>
      Effect.gen(function* () {
        const justBefore = yield* readSessionExpiryAfter(7 * DAY - SECOND);
        const justAfter = yield* readSessionExpiryAfter(7 * DAY + SECOND);

        expect({
          justAfter: Option.isSome(justAfter),
          justBefore: Option.isSome(justBefore),
        }).toStrictEqual({ justAfter: false, justBefore: true });
      })
  );

  it.effect(
    "should extend a session to seven days from the read when the read comes more than a day after sign-up",
    () =>
      Effect.gen(function* () {
        const withinADay = yield* readSessionExpiryAfter(DAY - 60 * SECOND);
        const pastADay = yield* readSessionExpiryAfter(DAY + 60 * SECOND);

        expect({ pastADay, withinADay }).toStrictEqual({
          pastADay: Option.some(SIGNED_UP_AT + DAY + 60 * SECOND + 7 * DAY),
          withinADay: Option.some(SIGNED_UP_AT + 7 * DAY),
        });
      })
  );
});
