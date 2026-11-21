import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { rejectionOf } from "@/shared/gateway/rejection";
import { DriverFailed } from "@/test/defect";
import { makeRunHandler } from "./runtime.ts";

const STACK = "DriverFailed: marker-secret\n    at runtime.test.ts:1:1";

const defectWithStack = (): DriverFailed => {
  const error = DriverFailed.make({ message: "marker-secret" });
  Object.defineProperty(error, "stack", { configurable: true, value: STACK });
  return error;
};

const loggedRecord = {
  event: "gateway.handlerDefect",
  message: "marker-secret",
  name: "DriverFailed",
  stack: STACK,
};

const FIXED_MESSAGE = "The request could not be completed";

const silenceConsoleError = () =>
  vi.spyOn(console, "error").mockImplementation((): void => {});

const dyingLayer = () => Layer.effectDiscard(Effect.die(defectWithStack()));

describe(makeRunHandler, () => {
  it.effect(
    "should resolve with the handler's value when the handler succeeds",
    () =>
      Effect.gen(function* () {
        const run = makeRunHandler(Layer.empty);

        const answer = yield* Effect.promise(() =>
          run(Effect.succeed("value"))
        );

        expect(answer).toBe("value");
      })
  );

  it.effect("should log nothing when the handler succeeds", () =>
    Effect.gen(function* () {
      const errorSpy = silenceConsoleError();
      const run = makeRunHandler(Layer.empty);

      yield* Effect.promise(() => run(Effect.succeed("value")));

      expect(errorSpy.mock.calls).toStrictEqual([]);
    })
  );

  it.effect(
    "should log the finalizer's defect beside the handler's when both die",
    () =>
      Effect.gen(function* () {
        const errorSpy = silenceConsoleError();
        const run = makeRunHandler(Layer.empty);
        const finalizerDefect = DriverFailed.make({
          message: "finalizer-secret",
        });
        Object.defineProperty(finalizerDefect, "stack", {
          configurable: true,
          value: "DriverFailed: finalizer-secret",
        });

        yield* rejectionOf(() =>
          run(
            Effect.die(defectWithStack()).pipe(
              Effect.ensuring(Effect.die(finalizerDefect))
            )
          )
        );

        expect(errorSpy.mock.calls).toStrictEqual([
          [loggedRecord],
          [
            {
              ...loggedRecord,
              message: "finalizer-secret",
              stack: "DriverFailed: finalizer-secret",
            },
          ],
        ]);
      })
  );

  it.effect(
    "should reject with the fixed message when the handler is interrupted",
    () =>
      Effect.gen(function* () {
        silenceConsoleError();
        const run = makeRunHandler(Layer.empty);

        const rejection = yield* rejectionOf(() => run(Effect.interrupt));

        expect(rejection).toHaveProperty("message", FIXED_MESSAGE);
      })
  );

  it.effect("should log one record when the handler is interrupted", () =>
    Effect.gen(function* () {
      const errorSpy = silenceConsoleError();
      const run = makeRunHandler(Layer.empty);

      yield* rejectionOf(() => run(Effect.interrupt));

      expect(errorSpy).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "should reject with the fixed message rather than the defect's when the handler dies",
    () =>
      Effect.gen(function* () {
        silenceConsoleError();
        const run = makeRunHandler(Layer.empty);

        const rejection = yield* rejectionOf(() =>
          run(Effect.die(defectWithStack()))
        );

        expect(rejection).toHaveProperty("message", FIXED_MESSAGE);
      })
  );

  it.effect(
    "should log the defect under the handler event when the handler dies",
    () =>
      Effect.gen(function* () {
        const errorSpy = silenceConsoleError();
        const run = makeRunHandler(Layer.empty);

        yield* rejectionOf(() => run(Effect.die(defectWithStack())));

        expect(errorSpy.mock.calls).toStrictEqual([[loggedRecord]]);
      })
  );

  it.effect(
    "should reject with the fixed message rather than the defect's when building the layer dies",
    () =>
      Effect.gen(function* () {
        silenceConsoleError();
        const run = makeRunHandler(dyingLayer());

        const rejection = yield* rejectionOf(() =>
          run(Effect.succeed("value"))
        );

        expect(rejection).toHaveProperty("message", FIXED_MESSAGE);
      })
  );

  it.effect(
    "should log the defect under the handler event when building the layer dies",
    () =>
      Effect.gen(function* () {
        const errorSpy = silenceConsoleError();
        const run = makeRunHandler(dyingLayer());

        yield* rejectionOf(() => run(Effect.succeed("value")));

        expect(errorSpy.mock.calls).toStrictEqual([[loggedRecord]]);
      })
  );
});
