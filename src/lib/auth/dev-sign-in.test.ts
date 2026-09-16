import { describe, expect, it, vi } from "vite-plus/test";
import { DriverFailed } from "@/test/defect";
import { createDevSignIn } from "./dev-sign-in";
import type { DevSignInDeps } from "./dev-sign-in";
import type { DevUser } from "./dev-users";

const DEV_USER: DevUser = {
  email: "dev@example.com",
  name: "Dev User",
  password: "dev-password",
};

const RECOVERY =
  "Run bun run db:push:local. If that does not help, reset the local D1.";

const makeFakes = () => {
  const signIn = vi.fn<DevSignInDeps["signIn"]>();
  const signUp = vi.fn<DevSignInDeps["signUp"]>();
  return { devSignIn: createDevSignIn({ signIn, signUp }), signIn, signUp };
};

describe("devSignIn", () => {
  it("should sign in without creating a user when the account already exists", async () => {
    const { devSignIn, signIn, signUp } = makeFakes();
    signIn.mockResolvedValue(null);

    const result = await devSignIn(DEV_USER);

    expect({ result, signUpCalls: signUp.mock.calls }).toStrictEqual({
      result: { kind: "signed-in" },
      signUpCalls: [],
    });
  });

  it("should report the account as created when the first sign-in is rejected", async () => {
    const { devSignIn, signIn, signUp } = makeFakes();
    signIn.mockResolvedValue("invalid credentials");
    signUp.mockResolvedValue(null);

    const result = await devSignIn(DEV_USER);

    expect({ result, signInCalls: signIn.mock.calls.length }).toStrictEqual({
      result: { kind: "created" },
      signInCalls: 1,
    });
  });

  it("should fail with the recovery step when the sign-up is rejected", async () => {
    const { devSignIn, signIn, signUp } = makeFakes();
    signIn.mockResolvedValue("invalid credentials");
    signUp.mockResolvedValue("User already exists.");

    const result = await devSignIn(DEV_USER);

    expect(result).toStrictEqual({
      kind: "failed",
      message: `User already exists. ${RECOVERY}`,
    });
  });

  it("should fail with the thrown message when the request never reaches the server", async () => {
    const { devSignIn, signIn } = makeFakes();
    signIn.mockRejectedValue(new DriverFailed({ message: "Failed to fetch" }));

    const result = await devSignIn(DEV_USER);

    expect(result).toStrictEqual({
      kind: "failed",
      message: "Failed to fetch",
    });
  });

  it("should fail with the recovery step when the thrown value is not an error", async () => {
    const { devSignIn, signIn } = makeFakes();
    signIn.mockRejectedValue("offline");

    const result = await devSignIn(DEV_USER);

    expect(result).toStrictEqual({ kind: "failed", message: RECOVERY });
  });
});
