import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { DriverFailed } from "@/test/defect";
import type { SignInFailure } from "./outcome";
import { signInThrewOutcome, socialSignInOutcome } from "./outcome";

describe(socialSignInOutcome, () => {
  it("should report a redirect when the provider call carries no failure", () => {
    const failure = Option.none<SignInFailure>();

    const outcome = socialSignInOutcome(failure);

    expect(outcome).toStrictEqual({ kind: "redirecting" });
  });

  it("should carry the provider's own message when the call failed", () => {
    const failure = Option.some({ message: Option.some("invalid client") });

    const outcome = socialSignInOutcome(failure);

    expect(outcome).toStrictEqual({
      kind: "failed",
      message: "invalid client",
    });
  });

  it("should name the sign-in when the failure carries no message", () => {
    const failure = Option.some<SignInFailure>({ message: Option.none() });

    const outcome = socialSignInOutcome(failure);

    expect(outcome).toStrictEqual({
      kind: "failed",
      message: "sign-in failed",
    });
  });
});

describe(signInThrewOutcome, () => {
  it("should carry the thrown message when the request never reached the server", () => {
    const cause = new DriverFailed({ message: "Failed to fetch" });

    const outcome = signInThrewOutcome(cause);

    expect(outcome).toStrictEqual({
      kind: "failed",
      message: "Failed to fetch",
    });
  });

  it("should name the sign-in when the thrown value is not an error", () => {
    const cause = "offline";

    const outcome = signInThrewOutcome(cause);

    expect(outcome).toStrictEqual({
      kind: "failed",
      message: "sign-in failed",
    });
  });
});
