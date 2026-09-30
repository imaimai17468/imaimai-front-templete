import "@tanstack/react-start/server-only";
import {
  Array as Arr,
  Cause,
  Effect,
  Exit,
  Layer,
  identity,
  ManagedRuntime,
  Result,
  Schema,
} from "effect";
import { reportError } from "@/lib/report-error";

// Passed to every runtime `makeRunHandler` builds, so a layer two of them
// reach is built once and the later runtime takes that instance. A map per
// runtime builds it again.
const appMemoMap = Layer.makeMemoMapUnsafe();

/**
 * What a caller receives in place of a defect.
 *
 * The framework serializes a rejection's `message` into the server function's
 * answer and into the document's inline script, so the message is fixed here
 * and the defect itself goes to Workers Logs.
 */
class HandlerFailed extends Schema.TaggedError<HandlerFailed>()(
  "HandlerFailed",
  { message: Schema.String }
) {}

const HANDLER_FAILED_MESSAGE = "The request could not be completed";

const HANDLER_DEFECT_EVENT = "gateway.handlerDefect";

/**
 * Every defect the cause holds, so a finalizer's defect is logged beside the
 * handler's. A cause holding only interruptions has none, and logs the error
 * `Cause.squash` builds for it.
 */
const defectsToLog = (cause: Cause.Cause<never>): readonly unknown[] =>
  Arr.match(
    Arr.filterMap(cause.reasons, (reason) =>
      Result.liftPredicate(reason, Cause.isDieReason, identity).pipe(
        Result.map((die) => die.defect)
      )
    ),
    {
      onEmpty: () => [Cause.squash(cause)],
      onNonEmpty: (defects) => defects,
    }
  );

const answerFromExit = <A>(exit: Exit.Exit<A>): Effect.Effect<A> =>
  Exit.match(exit, {
    onFailure: (cause) =>
      Effect.forEach(
        defectsToLog(cause),
        (defect) => reportError(HANDLER_DEFECT_EVENT, defect),
        { discard: true }
      ).pipe(
        Effect.andThen(
          Effect.die(new HandlerFailed({ message: HANDLER_FAILED_MESSAGE }))
        )
      ),
    onSuccess: Effect.succeed,
  });

/**
 * Builds the function that runs a handler's Effect against `layer` and hands
 * the framework the Promise it expects.
 *
 * `never` in the error channel is what a handler has to satisfy to get here, so
 * a failure added to the gateway and left without a result fails to
 * compile at the call site rather than reaching the framework as a rejection.
 * A defect, raised by the handler or while building `layer`, rejects with
 * `HandlerFailed` once it has been logged.
 */
export const makeRunHandler = <R>(layer: Layer.Layer<R>) => {
  const runtime = ManagedRuntime.make(layer, { memoMap: appMemoMap });
  return <A>(handler: Effect.Effect<A, never, R>): Promise<A> =>
    runtime
      .runPromiseExit(handler)
      .then((exit) => Effect.runPromise(answerFromExit(exit)));
};
