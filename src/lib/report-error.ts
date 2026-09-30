import { DrizzleQueryError } from "drizzle-orm/errors";
import type { Effect } from "effect";
import { Console, Option, Predicate, Schema } from "effect";

/**
 * The report's two representations in one declaration: `Option<string>` on the
 * Type side for the two fields an `Error` may not carry, and the plain JSON
 * shape Workers Logs receives on the Encoded side.
 */
const ErrorReportSchema = Schema.Struct({
  event: Schema.String,
  message: Schema.String,
  name: Schema.OptionFromNullOr(Schema.String),
  stack: Schema.OptionFromNullOr(Schema.String),
});

type ErrorReport = typeof ErrorReportSchema.Type;

export type ErrorLogRecord = typeof ErrorReportSchema.Encoded;

// `JSON.stringify` renders an `Option` as `{"_id":"Option","_tag":"None"}`, so
// the console sink takes the encoded record instead of the report itself.
const errorLogRecord = (report: ErrorReport): ErrorLogRecord => ({
  event: report.event,
  message: report.message,
  name: Option.getOrNull(report.name),
  stack: Option.getOrNull(report.stack),
});

// Drizzle's class leaves `name` at the inherited "Error".
const FAILED_QUERY_NAME = "DrizzleQueryError";

/**
 * A failed query as Workers Logs may keep it.
 *
 * Drizzle's own message and stack end in `params:` and the bound values, which
 * are the caller's data, so the record takes the SQL text, whose values are
 * placeholders, and the driver's error that Drizzle wrapped.
 */
const failedQueryReport = (
  event: string,
  error: DrizzleQueryError
): ErrorReport => {
  const driverError = Option.liftPredicate(error.cause, Predicate.isError);
  const driverMessage = driverError.pipe(
    Option.map((driver) => `\n${driver.name}: ${driver.message}`),
    Option.getOrElse(() => "")
  );
  return {
    event,
    message: `Failed query: ${error.query}${driverMessage}`,
    name: Option.some(FAILED_QUERY_NAME),
    stack: driverError.pipe(
      Option.flatMap((driver) => Option.fromUndefinedOr(driver.stack))
    ),
  };
};

export const errorReport = (event: string, cause: unknown): ErrorReport => {
  if (cause instanceof DrizzleQueryError) {
    return failedQueryReport(event, cause);
  }
  if (Predicate.isError(cause)) {
    return {
      event,
      message: cause.message,
      name: Option.some(cause.name),
      stack: Option.fromUndefinedOr(cause.stack),
    };
  }
  return {
    event,
    message: String(cause),
    name: Option.none(),
    stack: Option.none(),
  };
};

export const reportError = (
  event: string,
  cause: unknown
): Effect.Effect<void> =>
  Console.error(errorLogRecord(errorReport(event, cause)));
