import { Context, Effect, Layer } from "effect";
import type { UserWithEmail } from "@/entities/user";
import { UserGateway } from "@/gateways/user";
import type { UserPersistenceError } from "@/gateways/user";
import { CurrentSession } from "@/lib/auth/current-session.live";
import { makeRunHandler } from "./runtime.live";

/**
 * The authorization boundary between a caller and the user's own profile row.
 *
 * Its dependencies are services rather than arguments, so a test provides a
 * layer instead of a session cookie and a D1 binding, and so the check itself
 * stays the only thing under test.
 */
export class CurrentUserReader extends Context.Service<
  CurrentUserReader,
  {
    readonly read: Effect.Effect<UserWithEmail | null, UserPersistenceError>;
  }
>()("app/server/fn/CurrentUserReader") {
  static readonly layerNoDeps = Layer.effect(
    CurrentUserReader,
    Effect.gen(function* buildCurrentUserReader() {
      const currentSession = yield* CurrentSession;
      const gateway = yield* UserGateway;

      const read = Effect.gen(function* readCurrentUser() {
        const session = yield* currentSession.read;
        if (!session?.user) {
          return null;
        }
        return yield* gateway.fetchCurrentUser(
          session.user.id,
          session.user.email
        );
      });

      return CurrentUserReader.of({ read });
    })
  );

  static readonly layer = CurrentUserReader.layerNoDeps.pipe(
    Layer.provide(CurrentSession.layer),
    Layer.provide(UserGateway.layer)
  );
}

/**
 * The reader's result with its error channel discharged.
 *
 * A row the caller owns either loads or it does not; a D1 failure has no
 * user-facing branch here, so it becomes a defect and the framework answers it
 * the way it answers any other rejection. Naming the tag rather than calling
 * `Effect.orDie` keeps a failure added later out of this arm.
 */
export const readCurrentUser: Effect.Effect<
  UserWithEmail | null,
  never,
  CurrentUserReader
> = Effect.gen(function* readCurrentUser() {
  const reader = yield* CurrentUserReader;
  return yield* reader.read;
}).pipe(
  Effect.catchTags({
    UserPersistenceError: (error) => Effect.die(error.cause),
  })
);

const runCurrentUserHandler = makeRunHandler(CurrentUserReader.layer);

/** Reads the caller's own profile row and hands back a Promise. */
export const runCurrentUser = async (): Promise<UserWithEmail | null> =>
  await runCurrentUserHandler(readCurrentUser);
