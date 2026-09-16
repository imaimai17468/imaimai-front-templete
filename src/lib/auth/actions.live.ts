import { Option } from "effect";
import { authClient } from "./auth-client.live";
import { devSignIn } from "./dev-sign-in.live";
import { DEV_USER } from "./dev-users";
import {
  devSignInOutcome,
  signInThrewOutcome,
  socialSignInOutcome,
} from "./sign-in";
import type { SignIn } from "./sign-in";

const signInWithGoogle: SignIn = () =>
  authClient.signIn
    .social({ callbackURL: "/", provider: "google" })
    .then(({ error }) =>
      socialSignInOutcome(
        Option.fromNullOr(error).pipe(
          Option.map((failure) => ({
            message: Option.fromUndefinedOr(failure.message),
          }))
        )
      )
    );

const signInAsDevUser: SignIn = () =>
  devSignIn(DEV_USER).then(devSignInOutcome);

/**
 * Vite replaces both `import.meta.env` reads with literals, so this call folds
 * at build time and a production build never runs the dev arm.
 */
const selectSignIn = (): SignIn => {
  if (import.meta.env.DEV && import.meta.env.VITE_GOOGLE_SIGN_IN !== "1") {
    return signInAsDevUser;
  }
  return signInWithGoogle;
};

const provider = selectSignIn();

/**
 * Resolves whatever happens, so the caller answers one shape: a request the
 * auth client could not send rejects, and that rejection becomes an outcome
 * here rather than reaching the caller as a thrown value.
 */
export const signIn: SignIn = () => provider().catch(signInThrewOutcome);

export const signOut = () => authClient.signOut();
