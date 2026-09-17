import { Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
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
  it("should sign in without creating a user when the account already exists", () => {
    const { devSignIn, signIn, signUp } = makeFakes();
    signIn.mockResolvedValue(Option.none());

    return devSignIn(DEV_USER).then((outcome) => {
      expect({ outcome, signUpCalls: signUp.mock.calls }).toStrictEqual({
        outcome: { kind: "signed-in" },
        signUpCalls: [],
      });
    });
  });

  it("should create the account and reach a session when the first sign-in is rejected", () => {
    const { devSignIn, signIn, signUp } = makeFakes();
    signIn.mockResolvedValue(reported("invalid credentials"));
    signUp.mockResolvedValue(Option.none());

    return devSignIn(DEV_USER).then((outcome) => {
      expect({ outcome, signUpCalls: signUp.mock.calls }).toStrictEqual({
        outcome: { kind: "signed-in" },
        signUpCalls: [[DEV_USER]],
      });
    });
  });

  it("should fail with the recovery step when the sign-up is rejected", () => {
    const { devSignIn, signIn, signUp } = makeFakes();
    signIn.mockResolvedValue(reported("invalid credentials"));
    signUp.mockResolvedValue(reported("User already exists."));

    return devSignIn(DEV_USER).then((outcome) => {
      expect(outcome).toStrictEqual({
        kind: "failed",
        message: `User already exists. ${RECOVERY}`,
      });
    });
  });

  it("should name the sign-up when the rejection carries no message", () => {
    const { devSignIn, signIn, signUp } = makeFakes();
    signIn.mockResolvedValue(reported("invalid credentials"));
    signUp.mockResolvedValue(Option.some({ message: Option.none() }));

    return devSignIn(DEV_USER).then((outcome) => {
      expect(outcome).toStrictEqual({
        kind: "failed",
        message: `sign-up failed ${RECOVERY}`,
      });
    });
  });

  it("should fail with the thrown message when the request never reaches the server", () => {
    const { devSignIn, signIn } = makeFakes();
    signIn.mockRejectedValue(new DriverFailed({ message: "Failed to fetch" }));

    return devSignIn(DEV_USER).then((outcome) => {
      expect(outcome).toStrictEqual({
        kind: "failed",
        message: "Failed to fetch",
      });
    });
  });

  it("should fail with the recovery step when the thrown value is not an error", () => {
    const { devSignIn, signIn } = makeFakes();
    signIn.mockRejectedValue("offline");

    return devSignIn(DEV_USER).then((outcome) => {
      expect(outcome).toStrictEqual({ kind: "failed", message: RECOVERY });
    });
  });
});
