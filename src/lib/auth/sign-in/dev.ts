import { Effect, Option, Predicate, Schema } from "effect";
import type { SignInFailure, SignInOutcome } from "./outcome";

/** The account a dev build signs in as, so a local session needs no Google credentials. */
export interface DevUser {
  readonly email: string;
  readonly name: string;
  readonly password: string;
}

export const DEV_USER: DevUser = {
  email: "dev@example.com",
  name: "Dev User",
  password: "dev-password",
};

export interface DevSignInDeps {
  readonly signIn: (user: DevUser) => Promise<Option.Option<SignInFailure>>;
  readonly signUp: (user: DevUser) => Promise<Option.Option<SignInFailure>>;
}

/** A rejection from the auth client, which carries no `failed` message of its own. */
class DevSignInThrew extends Schema.TaggedError<DevSignInThrew>()(
  "DevSignInThrew",
  { cause: Schema.Defect() }
) {}

const RECOVERY =
  "Run bun run db:push:local. If that does not help, reset the local D1.";

const SIGN_UP_FALLBACK_MESSAGE = "sign-up failed";

const attempt = (run: () => Promise<Option.Option<SignInFailure>>) =>
  Effect.tryPromise({
    catch: (cause) => new DevSignInThrew({ cause }),
    try: run,
  });

/**
 * The first sign-in doubles as the check for whether the dev user exists, so
 * its failure only selects the sign-up and its message is never reported.
 */
export const createDevSignIn =
  ({ signIn, signUp }: DevSignInDeps) =>
  (user: DevUser): Promise<SignInOutcome> =>
    Effect.runPromise(
      Effect.gen(function* attemptDevSignIn() {
        const signInFailure = yield* attempt(() => signIn(user));
        if (Option.isNone(signInFailure)) {
          return { kind: "signed-in" } satisfies SignInOutcome;
        }
        const signUpFailure = yield* attempt(() => signUp(user));
        if (Option.isSome(signUpFailure)) {
          const reported = Option.getOrElse(
            signUpFailure.value.message,
            () => SIGN_UP_FALLBACK_MESSAGE
          );
          return {
            kind: "failed",
            message: `${reported} ${RECOVERY}`,
          } satisfies SignInOutcome;
        }
        return { kind: "signed-in" } satisfies SignInOutcome;
      }).pipe(
        Effect.catchTag("DevSignInThrew", (error) =>
          Effect.succeed({
            kind: "failed",
            message: Option.liftPredicate(error.cause, Predicate.isError).pipe(
              Option.map((thrown) => thrown.message),
              Option.getOrElse(() => RECOVERY)
            ),
          } satisfies SignInOutcome)
        )
      )
    );
