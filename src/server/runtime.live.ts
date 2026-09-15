import type { Effect } from "effect";
import { Layer, ManagedRuntime } from "effect";
import { AvatarReader } from "@/server/fn/avatar";

// Passed in rather than left to `ManagedRuntime.make`, which allocates one per
// runtime: a second runtime built here takes this same map and shares the
// layers this one has already built.
const appMemoMap = Layer.makeMemoMapUnsafe();

const appRuntime = ManagedRuntime.make(AvatarReader.layer, {
  memoMap: appMemoMap,
});

/**
 * Runs a handler's Effect against the app's services and hands the framework
 * the Promise it expects.
 *
 * `never` in the error channel is what a handler has to satisfy to get here, so
 * a failure added to `src/server/fn/` and left without a response fails to
 * compile at the route rather than reaching the framework as a rejection.
 */
export const runHandler = async (
  handler: Effect.Effect<Response, never, AvatarReader>
): Promise<Response> => await appRuntime.runPromise(handler);
