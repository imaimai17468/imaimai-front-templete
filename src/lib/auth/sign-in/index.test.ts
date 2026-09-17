import { Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { DriverFailed } from "@/test/defect";
import { signIn } from "./index";

const client = vi.hoisted(() => ({
  endSession: vi.fn<() => Promise<never>>(),
  signInWithEmail: vi.fn<() => Promise<never>>(),
  signUpWithEmail: vi.fn<() => Promise<never>>(),
  startGoogleSignIn: vi.fn<() => Promise<never>>(),
}));

vi.mock("./client", () => client);

/**
 * Both calls reject, which names the provider through the call count and needs
 * no response shape. `restoreMocks` leaves a plain `vi.fn`'s calls in place,
 * so the counts are cleared here rather than between tests.
 */
const pressSignIn = (dev: boolean, googleSignIn: Option.Option<string>) => {
  vi.stubEnv("DEV", dev);
  vi.stubEnv("VITE_GOOGLE_SIGN_IN", Option.getOrUndefined(googleSignIn));
  vi.clearAllMocks();
  client.signInWithEmail.mockRejectedValue(
    new DriverFailed({ message: "unreachable in a test" })
  );
  client.startGoogleSignIn.mockRejectedValue(
    new DriverFailed({ message: "unreachable in a test" })
  );
  return signIn();
};

const providerCalls = () => ({
  email: client.signInWithEmail.mock.calls.length,
  google: client.startGoogleSignIn.mock.calls.length,
});

describe(signIn, () => {
  it("should sign in with the dev user's credentials when a dev build has not turned Google on", () =>
    pressSignIn(true, Option.none()).then(() => {
      expect(providerCalls()).toStrictEqual({ email: 1, google: 0 });
    }));

  it("should hand the sign-in to Google when a dev build sets VITE_GOOGLE_SIGN_IN", () =>
    pressSignIn(true, Option.some("1")).then(() => {
      expect(providerCalls()).toStrictEqual({ email: 0, google: 1 });
    }));

  it("should hand the sign-in to Google when the build is a production build", () =>
    pressSignIn(false, Option.none()).then(() => {
      expect(providerCalls()).toStrictEqual({ email: 0, google: 1 });
    }));
});
