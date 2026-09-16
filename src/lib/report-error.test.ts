import { describe, expect, it, vi } from "vite-plus/test";
import { DriverFailed } from "@/test/defect";
import { errorLogPayload, reportError } from "./report-error";

describe("report-error", () => {
  describe(errorLogPayload, () => {
    it("should copy name, message, and stack when the value is an Error", () => {
      const error = new DriverFailed({ message: "D1 failed" });

      expect(errorLogPayload("user.updateName", error)).toStrictEqual({
        event: "user.updateName",
        message: "D1 failed",
        name: "DriverFailed",
        stack: error.stack,
      });
    });

    it("should store a null stack when the Error has none", () => {
      const error = new DriverFailed({ message: "D1 failed" });
      Object.defineProperty(error, "stack", {
        configurable: true,
        value: undefined,
      });

      expect(errorLogPayload("user.updateName", error)).toStrictEqual({
        event: "user.updateName",
        message: "D1 failed",
        name: "DriverFailed",
        stack: null,
      });
    });

    it("should stringify the value when it is not an Error", () => {
      expect(errorLogPayload("user.updateName", "boom")).toStrictEqual({
        event: "user.updateName",
        message: "boom",
        name: null,
        stack: null,
      });
    });
  });

  describe(reportError, () => {
    it("should write the payload to console.error when called", () => {
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation((): void => {});
      const error = new DriverFailed({ message: "D1 failed" });

      reportError("user.updateName", error);

      expect(errorSpy.mock.calls).toStrictEqual([
        [errorLogPayload("user.updateName", error)],
      ]);
    });
  });
});
