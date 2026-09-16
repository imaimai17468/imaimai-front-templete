import { Effect, Option, Predicate, Schema } from "effect";
import type { DevUser } from "./dev-users";

type AuthFailureMessage = string;

export type DevSignInResult =
  | { kind: "signed-in" }
  | { kind: "created" }
  | { kind: "failed"; message: string };

export interface DevSignInDeps {
  signIn: (user: DevUser) => Promise<Option.Option<AuthFailureMessage>>;
  signUp: (user: DevUser) => Promise<Option.Option<AuthFailureMessage>>;
}

/** A rejection from the auth client, which carries no `failed` message of its own. */
class DevSignInThrew extends Schema.TaggedError<DevSignInThrew>()(
  "DevSignInThrew",
  { cause: Schema.Defect() }
) {}

const RECOVERY =
  "Run bun run db:push:local. If that does not help, reset the local D1.";

const attempt = (run: () => Promise<Option.Option<AuthFailureMessage>>) =>
  Effect.tryPromise({
    catch: (cause) => new DevSignInThrew({ cause }),
    try: run,
  });

export const createDevSignIn =
  ({ signIn, signUp }: DevSignInDeps) =>
  (user: DevUser): Promise<DevSignInResult> =>
    Effect.runPromise(
      Effect.gen(function* attemptDevSignIn() {
        const signInFailure = yield* attempt(() => signIn(user));
        if (Option.isNone(signInFailure)) {
          return { kind: "signed-in" } satisfies DevSignInResult;
        }
        const signUpFailure = yield* attempt(() => signUp(user));
        if (Option.isSome(signUpFailure)) {
          return {
            kind: "failed",
            message: `${signUpFailure.value} ${RECOVERY}`,
          } satisfies DevSignInResult;
        }
        return { kind: "created" } satisfies DevSignInResult;
      }).pipe(
        Effect.catchTag("DevSignInThrew", (error) =>
          Effect.succeed({
            kind: "failed",
            message: Option.liftPredicate(error.cause, Predicate.isError).pipe(
              Option.map((thrown) => thrown.message),
              Option.getOrElse(() => RECOVERY)
            ),
          } satisfies DevSignInResult)
        )
      )
    );
