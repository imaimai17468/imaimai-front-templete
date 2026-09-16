import { Schema } from "effect";

/**
 * Stands in for what a driver throws when a call fails for real.
 *
 * A tagged class rather than `new Error`, so a fixture carries the shape the
 * rest of the codebase raises, and the log records which driver failed.
 */
export class DriverFailed extends Schema.TaggedError<DriverFailed>()(
  "DriverFailed",
  { message: Schema.String }
) {}
