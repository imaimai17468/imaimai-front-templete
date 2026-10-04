import { describe, expect, it } from "@effect/vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Effect } from "effect";
import { authOptions } from "./options";

const buildTestAuth = (isDevBuild: boolean) =>
  betterAuth(
    authOptions({
      database: memoryAdapter({
        account: [],
        rateLimit: [],
        session: [],
        user: [],
        verification: [],
      }),
      isDevBuild,
      secrets: {
        authSecret: "options-test-secret-0123456789abcdef0123456789",
        googleClientId: "options-test-client-id",
        googleClientSecret: "options-test-client-secret",
      },
    })
  );

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
const signInStatuses = (
  auth: ReturnType<typeof buildTestAuth>,
  attempts: readonly SignInAttempt[]
) =>
  Effect.forEach(
    attempts,
    (attempt) =>
      Effect.promise(() => auth.handler(signInRequest(attempt))).pipe(
        Effect.map((response) => response.status)
      ),
    { concurrency: 1 }
  );

describe(authOptions, () => {
  it.each([
    { build: "dev", isDevBuild: true },
    { build: "production", isDevBuild: false },
  ])(
    "should enable database-backed rate limiting when the $build build runs without NODE_ENV=production",
    ({ isDevBuild }) =>
      buildTestAuth(isDevBuild).$context.then(({ rateLimit }) => {
        expect({
          enabled: rateLimit.enabled,
          storage: rateLimit.storage,
        }).toStrictEqual({ enabled: true, storage: "database" });
      })
  );

  it.effect(
    "should answer 429 to the fourth sign-in within ten seconds when cf-connecting-ip stays the same and x-forwarded-for changes",
    () =>
      Effect.gen(function* limitTheFourthSignIn() {
        const statuses = yield* signInStatuses(
          buildTestAuth(false),
          ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"].map(
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
      Effect.gen(function* countEachAddressSeparately() {
        const statuses = yield* signInStatuses(buildTestAuth(false), [
          { cfConnectingIp: "203.0.113.7", xForwardedFor: "198.51.100.1" },
          { cfConnectingIp: "203.0.113.7", xForwardedFor: "198.51.100.1" },
          { cfConnectingIp: "203.0.113.7", xForwardedFor: "198.51.100.1" },
          { cfConnectingIp: "203.0.113.8", xForwardedFor: "198.51.100.1" },
        ]);

        expect(statuses).toStrictEqual([400, 400, 400, 400]);
      })
  );
});
