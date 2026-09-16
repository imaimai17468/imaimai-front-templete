import type { Effect } from "effect";
import { Console, Option, Schema } from "effect";

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

export const errorReport = (event: string, cause: unknown): ErrorReport => {
  if (cause instanceof Error) {
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

/** Writes the encoded report to the console, as an Effect the caller sequences. */
export const reportError = (
  event: string,
  cause: unknown
): Effect.Effect<void> =>
  Console.error(errorLogRecord(errorReport(event, cause)));
