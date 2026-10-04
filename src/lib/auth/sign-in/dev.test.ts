import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Option } from "effect";
import { DriverFailed } from "@/test/defect";
import type { DevSignInDeps } from "./dev";
import { createDevSignIn, DEV_USER } from "./dev";

const RECOVERY =
  "Run bun run db:push:local. If that does not help, reset the local D1.";

const reported = (message: string) =>
  Option.some({ message: Option.some(message) });

const makeFakes = () => {
  const signIn = vi.fn<DevSignInDeps["signIn"]>();
  const signUp = vi.fn<DevSignInDeps["signUp"]>();
  return { devSignIn: createDevSignIn({ signIn, signUp }), signIn, signUp };
};

describe("devSignIn", () => {
  it.effect(
    "should sign in without creating a user when the account already exists",
    () =>
      Effect.gen(function* signInWithoutCreatingAUser() {
        const { devSignIn, signIn, signUp } = makeFakes();
        signIn.mockResolvedValue(Option.none());

        const outcome = yield* Effect.promise(() => devSignIn(DEV_USER));

        expect({ outcome, signUpCalls: signUp.mock.calls }).toStrictEqual({
          outcome: { kind: "signed-in" },
          signUpCalls: [],
        });
      })
  );

  it.effect(
    "should create the account and reach a session when the first sign-in is rejected",
    () =>
      Effect.gen(function* createTheAccountAndReachASession() {
        const { devSignIn, signIn, signUp } = makeFakes();
        signIn.mockResolvedValue(reported("invalid credentials"));
        signUp.mockResolvedValue(Option.none());

        const outcome = yield* Effect.promise(() => devSignIn(DEV_USER));

        expect({ outcome, signUpCalls: signUp.mock.calls }).toStrictEqual({
          outcome: { kind: "signed-in" },
          signUpCalls: [[DEV_USER]],
        });
      })
  );

  it.effect(
    "should fail with the recovery step when the sign-up is rejected",
    () =>
      Effect.gen(function* failWithTheRecoveryStep() {
        const { devSignIn, signIn, signUp } = makeFakes();
        signIn.mockResolvedValue(reported("invalid credentials"));
        signUp.mockResolvedValue(reported("User already exists."));

        const outcome = yield* Effect.promise(() => devSignIn(DEV_USER));

        expect(outcome).toStrictEqual({
          kind: "failed",
          message: `User already exists. ${RECOVERY}`,
        });
      })
  );

  it.effect(
    "should name the sign-up when the rejection carries no message",
    () =>
      Effect.gen(function* nameTheSignUp() {
        const { devSignIn, signIn, signUp } = makeFakes();
        signIn.mockResolvedValue(reported("invalid credentials"));
        signUp.mockResolvedValue(Option.some({ message: Option.none() }));

        const outcome = yield* Effect.promise(() => devSignIn(DEV_USER));

        expect(outcome).toStrictEqual({
          kind: "failed",
          message: `sign-up failed ${RECOVERY}`,
        });
      })
  );

  it.effect(
    "should fail with the thrown message when the request never reaches the server",
    () =>
      Effect.gen(function* failWithTheThrownMessage() {
        const { devSignIn, signIn } = makeFakes();
        signIn.mockRejectedValue(
          new DriverFailed({ message: "Failed to fetch" })
        );

        const outcome = yield* Effect.promise(() => devSignIn(DEV_USER));

        expect(outcome).toStrictEqual({
          kind: "failed",
          message: "Failed to fetch",
        });
      })
  );

  it.effect(
    "should fail with the recovery step when the thrown value is not an error",
    () =>
      Effect.gen(function* failWithTheRecoveryStepForANonError() {
        const { devSignIn, signIn } = makeFakes();
        signIn.mockRejectedValue("offline");

        const outcome = yield* Effect.promise(() => devSignIn(DEV_USER));

        expect(outcome).toStrictEqual({ kind: "failed", message: RECOVERY });
      })
  );
});
