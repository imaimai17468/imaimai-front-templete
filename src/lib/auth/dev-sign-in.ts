import { Effect, Option, Schema } from "effect";
import type { DevUser } from "./dev-users";

type AuthFailureMessage = string;

export type DevSignInResult =
  | { kind: "signed-in" }
  | { kind: "created" }
  | { kind: "failed"; message: string };

export interface DevSignInDeps {
  signIn: (user: DevUser) => Promise<AuthFailureMessage | null>;
  signUp: (user: DevUser) => Promise<AuthFailureMessage | null>;
}

/** A rejection from the auth client, which carries no `failed` message of its own. */
class DevSignInThrew extends Schema.TaggedError<DevSignInThrew>()(
  "DevSignInThrew",
  { cause: Schema.Defect() }
) {}

const isError = (cause: unknown): cause is Error => cause instanceof Error;

const RECOVERY =
  "Run bun run db:push:local. If that does not help, reset the local D1.";

const attempt = (run: () => Promise<AuthFailureMessage | null>) =>
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
        if (signInFailure === null) {
          return { kind: "signed-in" } satisfies DevSignInResult;
        }
        const signUpFailure = yield* attempt(() => signUp(user));
        if (signUpFailure !== null) {
          return {
            kind: "failed",
            message: `${signUpFailure} ${RECOVERY}`,
          } satisfies DevSignInResult;
        }
        return { kind: "created" } satisfies DevSignInResult;
      }).pipe(
        Effect.catchTag("DevSignInThrew", (error) =>
          Effect.succeed({
            kind: "failed",
            message: Option.liftPredicate(error.cause, isError).pipe(
              Option.map((thrown) => thrown.message),
              Option.getOrElse(() => RECOVERY)
            ),
          } satisfies DevSignInResult)
        )
      )
    );
