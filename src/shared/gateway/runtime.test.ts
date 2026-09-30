import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { DriverFailed } from "@/test/defect";
import { makeRunHandler } from "./runtime";

const STACK = "DriverFailed: marker-secret\n    at runtime.test.ts:1:1";

const defectWithStack = (): DriverFailed => {
  const error = new DriverFailed({ message: "marker-secret" });
  Object.defineProperty(error, "stack", { configurable: true, value: STACK });
  return error;
};

const loggedRecord = {
  event: "gateway.handlerDefect",
  message: "marker-secret",
  name: "DriverFailed",
  stack: STACK,
};

const FIXED_MESSAGE = /^The request could not be completed$/u;

const silenceConsoleError = () =>
  vi.spyOn(console, "error").mockImplementation((): void => {});

const dyingLayer = () => Layer.effectDiscard(Effect.die(defectWithStack()));

describe(makeRunHandler, () => {
  it("should resolve with the handler's value when the handler succeeds", () => {
    const run = makeRunHandler(Layer.empty);

    const answer = run(Effect.succeed("value"));

    return expect(answer).resolves.toBe("value");
  });

  it("should log nothing when the handler succeeds", () => {
    const errorSpy = silenceConsoleError();
    const run = makeRunHandler(Layer.empty);

    return run(Effect.succeed("value")).then(() => {
      expect(errorSpy.mock.calls).toStrictEqual([]);
    });
  });

  it("should log the finalizer's defect beside the handler's when both die", () => {
    const errorSpy = silenceConsoleError();
    const run = makeRunHandler(Layer.empty);
    const finalizerDefect = new DriverFailed({ message: "finalizer-secret" });
    Object.defineProperty(finalizerDefect, "stack", {
      configurable: true,
      value: "DriverFailed: finalizer-secret",
    });

    return run(
      Effect.die(defectWithStack()).pipe(
        Effect.ensuring(Effect.die(finalizerDefect))
      )
    )
      .catch((): void => {})
      .then(() => {
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
      });
  });

  it("should reject with the fixed message when the handler is interrupted", () => {
    silenceConsoleError();
    const run = makeRunHandler(Layer.empty);

    const answer = run(Effect.interrupt);

    return expect(answer).rejects.toThrow(FIXED_MESSAGE);
  });

  it("should log one record when the handler is interrupted", () => {
    const errorSpy = silenceConsoleError();
    const run = makeRunHandler(Layer.empty);

    return run(Effect.interrupt)
      .catch((): void => {})
      .then(() => {
        expect(errorSpy).toHaveBeenCalledOnce();
      });
  });

  it("should reject with the fixed message rather than the defect's when the handler dies", () => {
    silenceConsoleError();
    const run = makeRunHandler(Layer.empty);

    const answer = run(Effect.die(defectWithStack()));

    return expect(answer).rejects.toThrow(FIXED_MESSAGE);
  });

  it("should log the defect under the handler event when the handler dies", () => {
    const errorSpy = silenceConsoleError();
    const run = makeRunHandler(Layer.empty);

    return run(Effect.die(defectWithStack()))
      .catch((): void => {})
      .then(() => {
        expect(errorSpy.mock.calls).toStrictEqual([[loggedRecord]]);
      });
  });

  it("should reject with the fixed message rather than the defect's when building the layer dies", () => {
    silenceConsoleError();
    const run = makeRunHandler(dyingLayer());

    const answer = run(Effect.succeed("value"));

    return expect(answer).rejects.toThrow(FIXED_MESSAGE);
  });

  it("should log the defect under the handler event when building the layer dies", () => {
    const errorSpy = silenceConsoleError();
    const run = makeRunHandler(dyingLayer());

    return run(Effect.succeed("value"))
      .catch((): void => {})
      .then(() => {
        expect(errorSpy.mock.calls).toStrictEqual([[loggedRecord]]);
      });
  });
});
