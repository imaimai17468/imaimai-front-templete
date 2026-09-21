import "@tanstack/react-start/server-only";
import { eq } from "drizzle-orm";
import { DateTime, Effect, Option, Schema } from "effect";
import { getDb } from "@/lib/drizzle/db";
import { users } from "@/lib/drizzle/schema";
import { reportError } from "@/lib/report-error";

/**
 * A D1 row read or write, or an R2 object write on a user's behalf, that did
 * not complete.
 *
 * One type covers both stores because nothing above discriminates them. The
 * write paths send it through `orNone` or `succeeded`, which log the cause and
 * branch on the result, and the read path leaves it in the error channel for
 * its caller to discharge.
 */
export class UserPersistenceError extends Schema.TaggedError<UserPersistenceError>()(
  "UserPersistenceError",
  { cause: Schema.Defect() }
) {}

/** A write the store reported as touching a number of rows nobody expects. */
class UnexpectedRowCount extends Schema.TaggedError<UnexpectedRowCount>()(
  "UnexpectedRowCount",
  { message: Schema.String }
) {}

export const persistenceEffect = <A>(
  run: () => Promise<A>
): Effect.Effect<A, UserPersistenceError> =>
  Effect.tryPromise({
    catch: (cause) => new UserPersistenceError({ cause }),
    try: run,
  });

/**
 * The columns a profile write sets beside `updatedAt`, which it always sets.
 *
 * Each column is named here, because the helper below takes the row's id as an
 * argument: whatever this type admits is writable without the authorization
 * boundary the two writers hold. A third column is an edit to this line.
 */
type UserRowUpdate = Partial<
  Pick<typeof users.$inferInsert, "avatarKey" | "name">
>;

/**
 * Writes `columns` onto one user's row and reports how many rows the store
 * touched, so a caller can reject a write that addressed nobody.
 */
export const writeUserRow = (
  userId: string,
  columns: UserRowUpdate,
  updatedAt: DateTime.Utc
): Effect.Effect<number, UserPersistenceError> =>
  persistenceEffect(() =>
    getDb()
      .update(users)
      .set({ ...columns, updatedAt: DateTime.toDateUtc(updatedAt) })
      .where(eq(users.id, userId))
      .returning({ id: users.id })
      .then((rows) => rows.length)
  );

/**
 * The value the effect produced, or `None` once the cause has been written to
 * Workers Logs under `event`.
 */
export const orNone = <A>(
  event: string,
  effect: Effect.Effect<A, UserPersistenceError>
): Effect.Effect<Option.Option<A>> =>
  effect.pipe(
    Effect.asSome,
    Effect.catchTags({
      UserPersistenceError: (error) =>
        reportError(event, error.cause).pipe(Effect.as(Option.none<A>())),
    })
  );

/**
 * Whether the write touched the single row it addressed.
 *
 * A count other than one reaches Workers Logs under `event` as an
 * `UnexpectedRowCount`; a write that failed outright was already logged there
 * by `orNone`. Both answer `false`, because a caller that cannot tell them
 * apart still has to reject the write.
 */
export const wroteOneRow = Effect.fn("wroteOneRow")(function* wroteOneRow(
  event: string,
  write: Effect.Effect<number, UserPersistenceError>
) {
  const rowsTouched = yield* orNone(event, write);
  if (Option.isNone(rowsTouched)) {
    return false;
  }
  if (rowsTouched.value === 1) {
    return true;
  }
  yield* reportError(
    event,
    new UnexpectedRowCount({
      message: `expected 1 row, got ${String(rowsTouched.value)}`,
    })
  );
  return false;
});

/**
 * Whether the write succeeded, once a failure's cause has been written to
 * Workers Logs under `event`. A failure is the caller's branch rather than an
 * error, because the avatar path reports a failed delete as a distinct result.
 */
export const succeeded = (
  event: string,
  effect: Effect.Effect<unknown, UserPersistenceError>
): Effect.Effect<boolean> =>
  effect.pipe(
    Effect.as(true),
    Effect.catchTags({
      UserPersistenceError: (error) =>
        reportError(event, error.cause).pipe(Effect.as(false)),
    })
  );
