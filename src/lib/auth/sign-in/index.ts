import { signInWithEmail, signUpWithEmail, startGoogleSignIn } from "./client";
import { createDevSignIn, DEV_USER } from "./dev";
import type { SignIn } from "./outcome";
import { signInThrewOutcome, socialSignInOutcome } from "./outcome";

/**
 * `createDevSignIn` is called here rather than bound at module scope, so the
 * only reference to `./dev` sits inside the arm `selectSignIn` folds away. A
 * production build then carries no part of that module: with the binding at
 * module scope, `dist/` held its recovery message and its fallback message.
 */
const signInAsDevUser: SignIn = () =>
  createDevSignIn({ signIn: signInWithEmail, signUp: signUpWithEmail })(
    DEV_USER
  );

const signInWithGoogle: SignIn = () =>
  startGoogleSignIn().then(socialSignInOutcome);

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

/**
 * Resolves whatever happens, so the caller answers one shape: a request the
 * auth client could not send rejects, and that rejection becomes an outcome
 * here rather than reaching the caller as a thrown value.
 */
export const signIn: SignIn = () => {
  const provider = selectSignIn();
  return provider().catch(signInThrewOutcome);
};

export { endSession as signOut } from "./client";
