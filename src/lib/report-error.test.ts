import { describe, expect, it } from "@effect/vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { Effect, Option } from "effect";
import { TestConsole } from "effect/testing";
import { ABSENT_FIELD } from "@/test/absent-field";
import { DriverFailed } from "@/test/defect";
import { errorReport, reportError } from "./report-error";

const STACK = "DriverFailed: D1 failed\n    at report-error.test.ts:1:1";

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

const UPDATE_QUERY =
  'update "users" set "name" = ?, "updated_at" = ? where "users"."id" = ?';
const PARAMS = ["Probe Person Name", 0, "user-123"];
const DRIVER_STACK = "DriverFailed: D1_ERROR: probe\n    at d1.ts:1:1";

const driverFailure = (): DriverFailed => {
  const error = new DriverFailed({ message: "D1_ERROR: probe" });
  Object.defineProperty(error, "stack", {
    configurable: true,
    value: DRIVER_STACK,
  });
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

    it("should keep the SQL text and the driver's error but not the parameters when a query fails", () => {
      const error = new DrizzleQueryError(
        UPDATE_QUERY,
        PARAMS,
        driverFailure()
      );

      expect(errorReport("user.updateName", error)).toStrictEqual({
        event: "user.updateName",
        message: `Failed query: ${UPDATE_QUERY}\nDriverFailed: D1_ERROR: probe`,
        name: Option.some("DrizzleQueryError"),
        stack: Option.some(DRIVER_STACK),
      });
    });

    it("should report the SQL text alone when a failed query wraps no driver error", () => {
      const error = new DrizzleQueryError(UPDATE_QUERY, PARAMS);

      expect(errorReport("user.updateName", error)).toStrictEqual({
        event: "user.updateName",
        message: `Failed query: ${UPDATE_QUERY}`,
        name: Option.some("DrizzleQueryError"),
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
    it.effect(
      "should write a plain record rather than the Option report when run",
      () =>
        Effect.gen(function* writePlainRecord() {
          yield* reportError("user.updateName", failureWithStack());
          const written = yield* TestConsole.errorLines;

          expect(written).toStrictEqual([
            {
              event: "user.updateName",
              message: "D1 failed",
              name: "DriverFailed",
              stack: STACK,
            },
          ]);
        })
    );

    it.effect(
      "should write an absent field rather than a None when the Error has no stack",
      () =>
        Effect.gen(function* writeAbsentStack() {
          yield* reportError("user.updateName", failureWithoutStack());
          const written = yield* TestConsole.errorLines;

          expect(written).toStrictEqual([
            {
              event: "user.updateName",
              message: "D1 failed",
              name: "DriverFailed",
              stack: ABSENT_FIELD,
            },
          ]);
        })
    );
  });
});
