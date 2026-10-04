import { Effect, identity } from "effect";

/**
 * What `answer`'s Promise rejected with, as the Effect's value.
 *
 * A Promise that resolves instead fails the Effect with what it resolved
 * with, so a test that expected a rejection fails there.
 */
export const rejectionOf = <A>(answer: () => Promise<A>) =>
  Effect.tryPromise({ catch: identity, try: answer }).pipe(Effect.flip);
