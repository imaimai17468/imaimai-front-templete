import { Context, Effect, Layer, Option } from "effect";
import type { UserWithEmail } from "@/entities/user";
import { CurrentSession } from "@/lib/auth/current-session.live";
import { UserGateway } from ".";
import type { UserPersistenceError } from ".";
import { makeRunHandler } from "../runtime.live";

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
    readonly read: Effect.Effect<
      Option.Option<UserWithEmail>,
      UserPersistenceError
    >;
  }
>()("app/gateways/user/CurrentUserReader") {
  static readonly layerNoDeps = Layer.effect(
    CurrentUserReader,
    Effect.gen(function* buildCurrentUserReader() {
      const currentSession = yield* CurrentSession;
      const gateway = yield* UserGateway;

      const read = Effect.gen(function* readCurrentUser() {
        const caller = yield* currentSession.read;
        if (Option.isNone(caller)) {
          return Option.none();
        }
        return yield* gateway.fetchCurrentUser(
          caller.value.id,
          caller.value.email
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
  Option.Option<UserWithEmail>,
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

/**
 * Reads the caller's own profile row and hands back a Promise.
 *
 * The Promise carries the nullable rather than the `Option`, because
 * `createServerFn` serializes this value and the receiver gets data alone. An
 * `Option` through `JSON.parse(JSON.stringify(...))` comes back as a plain
 * `{ _id: "Option", _tag: "None" }` whose `pipe` is `undefined`, so the type
 * would promise the receiver an `Option` it does not hold.
 */
export const getCurrentUser = () =>
  runCurrentUserHandler(readCurrentUser.pipe(Effect.map(Option.getOrNull)));
