import "@tanstack/react-start/server-only";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  Array,
  Console,
  Effect,
  Option,
  Predicate,
  References,
  Schema,
  String,
} from "effect";

/**
 * The report's two representations in one declaration: `Option<string>` on the
 * Type side for the two fields an `Error` may not carry, and the plain JSON
 * shape Workers Logs receives on the Encoded side. `operations` names the
 * `Effect.fn` operations the failure was raised in, or was turned into a
 * defect in, outermost first, so a reader of the log sees which operation
 * failed. A field the cause holds in a shape the record cannot carry, such as
 * a `null` stack, is recorded as absent, so encoding the record never fails.
 */
const ErrorReportSchema = Schema.Struct({
  event: Schema.String,
  message: Schema.String,
  name: Schema.OptionFromNullOr(Schema.String),
  operations: Schema.Array(Schema.String),
  stack: Schema.OptionFromNullOr(Schema.String),
});

type ErrorReport = typeof ErrorReportSchema.Type;

export type ErrorLogRecord = typeof ErrorReportSchema.Encoded;

// `JSON.stringify` renders an `Option` as `{"_id":"Option","_tag":"None"}`, so
// the console sink takes the encoded record instead of the report itself.
const encodeErrorReport = Schema.encodeEffect(ErrorReportSchema);

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
  error: DrizzleQueryError,
  operations: readonly string[]
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
    operations,
    stack: driverError.pipe(
      Option.flatMap((driver) =>
        Option.liftPredicate(driver.stack, Predicate.isString)
      )
    ),
  };
};

export const errorReport = (
  event: string,
  cause: unknown,
  operations: readonly string[]
): ErrorReport => {
  if (cause instanceof DrizzleQueryError) {
    return failedQueryReport(event, cause, operations);
  }
  if (Predicate.isError(cause)) {
    return {
      event,
      message: globalThis.String(cause.message),
      name: Option.liftPredicate(cause.name, Predicate.isString),
      operations,
      stack: Option.liftPredicate(cause.stack, Predicate.isString),
    };
  }
  return {
    event,
    message: globalThis.String(cause),
    name: Option.none(),
    operations,
    stack: Option.none(),
  };
};

// Each `Effect.fn` call leaves a second frame naming where the operation is
// defined, which names nothing the call's own frame does not.
const DEFINITION_FRAME = " (definition)";

/**
 * The `Effect.fn` operations `frame` lies inside, outermost first, for a
 * frame Effect recorded where a failure happened or where a report is written.
 */
export const operationNames = (
  frame: Option.Option<References.StackFrame>
): readonly string[] =>
  Option.match(frame, {
    onNone: (): readonly string[] => [],
    onSome: ({ name, parent }) => [
      ...operationNames(Option.fromUndefinedOr(parent)),
      ...Array.filter([name], (own) => !String.endsWith(DEFINITION_FRAME)(own)),
    ],
  });

/** A defect a handler died with and the operations it was raised inside. */
export interface DefectToLog {
  readonly defect: unknown;
  readonly operations: readonly string[];
}

/** Writes a handler's defect under `event` as one Workers Logs record. */
export const reportDefect = (
  event: string,
  { defect, operations }: DefectToLog
): Effect.Effect<void> =>
  encodeErrorReport(errorReport(event, defect, operations)).pipe(
    Effect.orDie,
    Effect.flatMap((record) => Console.error(record))
  );

/**
 * Writes the report of `cause` under `event` as one Workers Logs record,
 * naming the operations the caller is running inside.
 */
export const reportError = (
  event: string,
  cause: unknown
): Effect.Effect<void> =>
  References.CurrentStackFrame.pipe(
    Effect.flatMap((frame) =>
      reportDefect(event, {
        defect: cause,
        operations: operationNames(Option.fromUndefinedOr(frame)),
      })
    )
  );
