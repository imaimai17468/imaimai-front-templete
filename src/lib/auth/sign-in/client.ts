import { createAuthClient } from "better-auth/react";
import { Option } from "effect";
import type { SignInFailure } from "./outcome";

/**
 * Better Auth のクライアント。テンプレ用途で export を維持（派生プロジェクトが
 * 認証 UI を実装するときに `authClient.useSession` などをここから使う）。
 *
 * @public
 */
export const authClient = createAuthClient();

type AuthClientError = Awaited<ReturnType<typeof authClient.signOut>>["error"];

const reportedFailure = (
  error: AuthClientError
): Option.Option<SignInFailure> =>
  Option.fromNullOr(error).pipe(
    Option.map(({ message }) => ({ message: Option.fromUndefinedOr(message) }))
  );

export const signInWithEmail = (credentials: {
  readonly email: string;
  readonly password: string;
}) =>
  authClient.signIn
    .email(credentials)
    .then(({ error }) => reportedFailure(error));

export const signUpWithEmail = (account: {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}) =>
  authClient.signUp.email(account).then(({ error }) => reportedFailure(error));

export const startGoogleSignIn = () =>
  authClient.signIn
    .social({ callbackURL: "/", provider: "google" })
    .then(({ error }) => reportedFailure(error));

export const endSession = () => authClient.signOut();
