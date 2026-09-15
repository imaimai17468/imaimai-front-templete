import type { Effect } from "effect";
import { Layer, ManagedRuntime } from "effect";
import { AvatarReader } from "@/server/fn/avatar";

// Shared by every runtime built here. `CurrentSession.layer` sits under both
// `AvatarReader.layer` and `CurrentUserReader.layer`, and `UserGateway.layer`
// under both `CurrentUserReader.layer` and `ProfileWriter.layer`; one map
// across the runtimes builds each of those once and hands the later runtime
// that instance, where a map per runtime builds it again.
const appMemoMap = Layer.makeMemoMapUnsafe();

/**
 * Builds the function that runs a handler's Effect against `layer` and hands
 * the framework the Promise it expects.
 *
 * `never` in the error channel is what a handler has to satisfy to get here, so
 * a failure added to `src/server/fn/` and left without a result fails to
 * compile at the call site rather than reaching the framework as a rejection.
 */
export const makeRunHandler = <R>(layer: Layer.Layer<R>) => {
  const runtime = ManagedRuntime.make(layer, { memoMap: appMemoMap });
  return async <A>(handler: Effect.Effect<A, never, R>): Promise<A> =>
    await runtime.runPromise(handler);
};

export const runHandler = makeRunHandler(AvatarReader.layer);
