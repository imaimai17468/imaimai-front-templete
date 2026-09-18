import "@tanstack/react-start/server-only";
import { Effect, Option, Schema } from "effect";
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
export class UnexpectedRowCount extends Schema.TaggedError<UnexpectedRowCount>()(
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
