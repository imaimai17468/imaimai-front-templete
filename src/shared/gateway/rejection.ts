import "@tanstack/react-start/server-only";
import { Effect, Schema } from "effect";

class PromiseRejected extends Schema.TaggedError<
  PromiseRejected,
  { readonly brand: unique symbol }
>()("PromiseRejected", { cause: Schema.Defect() }) {}

/**
 * What `answer`'s Promise rejected with, as the Effect's value.
 *
 * A Promise that resolves instead fails the Effect with what it resolved
 * with, so a test that expected a rejection fails there.
 */
export const rejectionOf = <A>(answer: () => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) => PromiseRejected.make({ cause }),
    try: answer,
  }).pipe(
    Effect.flip,
    Effect.map(({ cause }) => cause)
  );
