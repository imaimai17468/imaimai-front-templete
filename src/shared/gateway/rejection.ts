import "@tanstack/react-start/server-only";
import { Effect } from "effect";

/**
 * What `answer`'s Promise rejected with, as the Effect's value.
 *
 * A Promise that resolves instead fails the Effect with what it resolved
 * with, so a test that expected a rejection fails there.
 */
export const rejectionOf = <A>(answer: () => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) => ({ rejected: cause }),
    try: answer,
  }).pipe(
    Effect.flip,
    Effect.map(({ rejected }) => rejected)
  );
