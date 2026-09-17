import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { Context, Effect, Layer, Option, Schema } from "effect";
import { UserWithEmailSchema } from "@/entities/user";
import type { UserWithEmail } from "@/entities/user";
import { CurrentSession } from "@/lib/auth/session";
import { avatarUrlForKey } from "@/lib/avatar-url";
import { getDb } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import { persistenceEffect } from ".";
import type { UserPersistenceError } from ".";
import { makeRunHandler } from "../runtime";

/**
 * Turns a row's `DateTime.Utc` instants into the ISO-8601 strings of
 * `UserWithEmail` and throws when a field fails its check, such as an email the
 * session carried that is not an address.
 */
const encodeUserWithEmail = Schema.encodeSync(UserWithEmailSchema);

/**
 * A `users` row as this gateway reads it.
 *
 * Decoding is what turns D1's `Date` columns into `DateTime.Utc` and its
 * nullable columns into `Option`, so neither conversion is written by hand.
 * `image` is Better Auth's column, holding whatever the social provider
 * supplied, and `avatarKey` names an object this app uploaded.
 */
const ProfileRowSchema = Schema.Struct({
  avatarKey: Schema.OptionFromNullOr(Schema.String),
  createdAt: Schema.DateTimeUtcFromDate,
  id: Schema.String,
  image: Schema.OptionFromNullOr(Schema.String),
  name: Schema.OptionFromNullOr(Schema.String),
  updatedAt: Schema.DateTimeUtcFromDate,
});

export type ProfileRow = typeof ProfileRowSchema.Type;

const decodeProfileRow = Schema.decodeUnknownSync(ProfileRowSchema);

/**
 * The profile row a caller's own id addresses.
 *
 * A service rather than a direct query so a test provides a row without a D1
 * binding, which is what keeps the authorization check below the only thing
 * under test.
 */
export class UserProfiles extends Context.Service<
  UserProfiles,
  {
    readonly findProfile: (
      userId: string
    ) => Effect.Effect<Option.Option<ProfileRow>, UserPersistenceError>;
  }
>()("app/gateways/user/UserProfiles") {
  static readonly layer = Layer.succeed(
    UserProfiles,
    UserProfiles.of({
      findProfile: (userId) =>
        persistenceEffect(() =>
          getDb()
            .select()
            .from(users)
            .where(eq(users.id, userId))
            .limit(1)
            .then(([row]) =>
              Option.fromNullishOr(row).pipe(Option.map(decodeProfileRow))
            )
        ),
    })
  );
}

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
      const profiles = yield* UserProfiles;

      const read = Effect.gen(function* readCurrentUser() {
        const caller = yield* currentSession.read;
        if (Option.isNone(caller)) {
          return Option.none();
        }
        const profile = yield* profiles.findProfile(caller.value.id);
        if (Option.isNone(profile)) {
          return Option.none();
        }
        const row = profile.value;
        return Option.some(
          encodeUserWithEmail({
            // An avatar this app uploaded wins over the social provider's
            // image, because the provider's URL is frozen at signup while the
            // key addresses whatever the user last uploaded.
            avatarUrl: row.avatarKey.pipe(
              Option.map(avatarUrlForKey),
              Option.orElse(() => row.image)
            ),
            createdAt: row.createdAt,
            email: caller.value.email,
            id: row.id,
            name: row.name,
            updatedAt: row.updatedAt,
          })
        );
      });

      return CurrentUserReader.of({ read });
    })
  );

  static readonly layer = CurrentUserReader.layerNoDeps.pipe(
    Layer.provide(CurrentSession.layer),
    Layer.provide(UserProfiles.layer)
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
