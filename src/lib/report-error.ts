import type { Effect } from "effect";
import { Console } from "effect";

export interface ErrorReport {
  readonly event: string;
  readonly message: string;
  readonly name: string | null;
  readonly stack: string | null;
}

export const errorLogPayload = (event: string, cause: unknown): ErrorReport => {
  if (cause instanceof Error) {
    return {
      event,
      message: cause.message,
      name: cause.name,
      stack: cause.stack ?? null,
    };
  }
  return {
    event,
    message: String(cause),
    name: null,
    stack: null,
  };
};

/** Writes the payload to the console, as an Effect the caller sequences. */
export const reportError = (
  event: string,
  cause: unknown
): Effect.Effect<void> => Console.error(errorLogPayload(event, cause));
