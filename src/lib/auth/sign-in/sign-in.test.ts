import { Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import type { MemoryAuth } from "@/test/auth-server";
import { connectBrowserTo, buildMemoryAuth } from "@/test/auth-server";
import { DriverFailed } from "@/test/defect";
import { DEV_USER } from "./dev.ts";
import type { SignInClient } from "./sign-in.ts";
import { createSignIn } from "./sign-in.ts";

const client = {
  signInWithEmail: vi.fn<SignInClient["signInWithEmail"]>(),
  signUpWithEmail: vi.fn<SignInClient["signUpWithEmail"]>(),
  startGoogleSignIn: vi.fn<SignInClient["startGoogleSignIn"]>(),
};

const stubBuild = (dev: boolean, googleSignIn: Option.Option<string>) => {
  vi.stubEnv("DEV", dev);
  vi.stubEnv("VITE_GOOGLE_SIGN_IN", Option.getOrUndefined(googleSignIn));
};

/**
 * Both calls reject, which names the provider through the call count and needs
 * no response shape. `restoreMocks` leaves a plain `vi.fn`'s calls in place,
 * so the counts are cleared here rather than between tests.
 */
const pressSignIn = (dev: boolean, googleSignIn: Option.Option<string>) => {
  stubBuild(dev, googleSignIn);
  vi.clearAllMocks();
  client.signInWithEmail.mockRejectedValue(
    DriverFailed.make({ message: "unreachable in a test" })
  );
  client.startGoogleSignIn.mockRejectedValue(
    DriverFailed.make({ message: "unreachable in a test" })
  );
  return createSignIn(client)();
};

const providerCalls = () => ({
  email: client.signInWithEmail.mock.calls.length,
  google: client.startGoogleSignIn.mock.calls.length,
});

const importSignIn = () => import("./sign-in.ts");

/**
 * Better Auth's client keeps the `fetch` it found when it was created, so the
 * module is evaluated again after `fetch` was routed to `auth`.
 */
const loadSignInAgainst = (auth: MemoryAuth) => {
  const browser = connectBrowserTo(auth);
  vi.spyOn(globalThis, "fetch").mockImplementation(browser.fetch);
  vi.resetModules();
  return importSignIn().then(({ signIn }) => ({ browser, signIn }));
};

describe(createSignIn, () => {
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

  it("should create the dev user when a dev build finds no account to sign in to", () => {
    stubBuild(true, Option.none());
    vi.clearAllMocks();
    client.signInWithEmail.mockResolvedValue(
      Option.some({ message: Option.some("Invalid email or password") })
    );
    client.signUpWithEmail.mockResolvedValue(Option.none());

    return createSignIn(client)().then((outcome) => {
      expect({
        outcome,
        signUpCalls: client.signUpWithEmail.mock.calls,
      }).toStrictEqual({
        outcome: { kind: "signed-in" },
        signUpCalls: [[DEV_USER]],
      });
    });
  });
});

describe("signIn through Better Auth", () => {
  it("should leave the dev user signed in when a dev build presses sign-in for the first time", () => {
    stubBuild(true, Option.none());
    const auth = buildMemoryAuth(true);

    return loadSignInAgainst(auth)
      .then(({ browser, signIn }) =>
        signIn().then((outcome) => ({ cookie: browser.cookie(), outcome }))
      )
      .then(({ cookie, outcome }) =>
        auth.api
          .getSession({ headers: new Headers({ cookie }) })
          .then((session) => ({
            email: Option.fromNullOr(session).pipe(
              Option.map(({ user }) => user.email)
            ),
            outcome,
          }))
      )
      .then((signedIn) => {
        expect(signedIn).toStrictEqual({
          email: Option.some(DEV_USER.email),
          outcome: { kind: "signed-in" },
        });
      });
  });

  it("should be leaving for Google when a production build presses sign-in", () => {
    stubBuild(false, Option.none());

    return loadSignInAgainst(buildMemoryAuth(false))
      .then(({ signIn }) => signIn())
      .then((outcome) => {
        expect(outcome).toStrictEqual({ kind: "redirecting" });
      });
  });
});
