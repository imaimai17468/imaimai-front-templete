import { Option, Predicate } from "effect";

/**
 * How one sign-in attempt ended: the client is already navigating to the
 * provider, the session exists while the page is still on /login, or nothing
 * was signed in.
 */
export type SignInOutcome =
  | { readonly kind: "redirecting" }
  | { readonly kind: "signed-in" }
  | { readonly kind: "failed"; readonly message: string };

/** One press of the sign-in button, whichever build picked the provider. */
export type SignIn = () => Promise<SignInOutcome>;

const FALLBACK_MESSAGE = "sign-in failed";

/** A failure the auth client reported, and the message it did or did not carry. */
export interface SignInFailure {
  readonly message: Option.Option<string>;
}

/**
 * Better Auth's redirect fetch plugin assigns `window.location.href` from the
 * provider URL inside its own `onSuccess` hook, so a social sign-in that
 * reports no failure has already started leaving the page.
 */
export const socialSignInOutcome = (
  failure: Option.Option<SignInFailure>
): SignInOutcome =>
  Option.match(failure, {
    onNone: (): SignInOutcome => ({ kind: "redirecting" }),
    onSome: ({ message }): SignInOutcome => ({
      kind: "failed",
      message: Option.getOrElse(message, () => FALLBACK_MESSAGE),
    }),
  });

/**
 * A request that never reached the server rejects instead of answering with a
 * failure field, so the thrown value carries everything there is to report.
 */
export const signInThrewOutcome = (cause: unknown): SignInOutcome => ({
  kind: "failed",
  message: Option.liftPredicate(cause, Predicate.isError).pipe(
    Option.map((thrown) => thrown.message),
    Option.getOrElse(() => FALLBACK_MESSAGE)
  ),
});
