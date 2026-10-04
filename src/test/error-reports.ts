import { Effect, Schema } from "effect";
import { TestConsole } from "effect/testing";
import type { ErrorLogRecord } from "@/lib/report-error";

type CapturedReport = Pick<ErrorLogRecord, "event" | "message" | "name">;

const CapturedReports = Schema.Array(
  Schema.Struct({
    event: Schema.String,
    message: Schema.String,
    name: Schema.NullOr(Schema.String),
  })
);

/**
 * The records `reportError` wrote to the `TestConsole` that `it.effect`
 * provides, without their `stack`, which holds the machine's absolute paths
 * and line numbers and so cannot sit in a `toStrictEqual` expectation.
 */
export const capturedReports: Effect.Effect<readonly CapturedReport[]> =
  TestConsole.errorLines.pipe(
    Effect.map(Schema.decodeUnknownSync(CapturedReports))
  );
