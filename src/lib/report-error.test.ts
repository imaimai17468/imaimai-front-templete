import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { DriverFailed } from "@/test/defect";
import { errorReport, reportError } from "./report-error";

const STACK = "DriverFailed: D1 failed\n    at report-error.test.ts:1:1";

// `effect/noNullish` reports a written `null`, so the encoding of an absent
// field is built from a `None` rather than spelled out.
const ABSENT_FIELD = Option.getOrNull(Option.none<string>());

const failureWithStack = (): DriverFailed => {
  const error = new DriverFailed({ message: "D1 failed" });
  Object.defineProperty(error, "stack", { configurable: true, value: STACK });
  return error;
};

const failureWithoutStack = (): DriverFailed => {
  const error = new DriverFailed({ message: "D1 failed" });
  Reflect.deleteProperty(error, "stack");
  return error;
};

describe("report-error", () => {
  describe(errorReport, () => {
    it("should copy name, message, and stack when the value is an Error", () => {
      const error = failureWithStack();

      expect(errorReport("user.updateName", error)).toStrictEqual({
        event: "user.updateName",
        message: "D1 failed",
        name: Option.some("DriverFailed"),
        stack: Option.some(STACK),
      });
    });

    it("should store a None stack when the Error has none", () => {
      const error = failureWithoutStack();

      expect(errorReport("user.updateName", error)).toStrictEqual({
        event: "user.updateName",
        message: "D1 failed",
        name: Option.some("DriverFailed"),
        stack: Option.none(),
      });
    });

    it("should stringify the value when it is not an Error", () => {
      expect(errorReport("user.updateName", "boom")).toStrictEqual({
        event: "user.updateName",
        message: "boom",
        name: Option.none(),
        stack: Option.none(),
      });
    });
  });

  describe(reportError, () => {
    it("should write a plain record rather than the Option report when run", () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation((): void => {});

      Effect.runSync(reportError("user.updateName", failureWithStack()));

      expect(errorSpy.mock.calls).toStrictEqual([
        [
          {
            event: "user.updateName",
            message: "D1 failed",
            name: "DriverFailed",
            stack: STACK,
          },
        ],
      ]);
    });

    it("should write an absent field rather than a None when the Error has no stack", () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation((): void => {});

      Effect.runSync(reportError("user.updateName", failureWithoutStack()));

      expect(errorSpy.mock.calls).toStrictEqual([
        [
          {
            event: "user.updateName",
            message: "D1 failed",
            name: "DriverFailed",
            stack: ABSENT_FIELD,
          },
        ],
      ]);
    });
  });
});
