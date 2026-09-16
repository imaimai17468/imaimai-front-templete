import { describe, expect, it } from "vite-plus/test";
import { requireContext } from "./require-context";

describe(requireContext, () => {
  it("should return the value when the provider supplied one", () => {
    const value = { id: "form-item" };

    const result = requireContext(value, "missing");

    expect(result).toBe(value);
  });

  it("should raise the given message when the context is null", () => {
    const message = "should be used within <FormField>";

    const read = () => requireContext(null, message);

    expect(read).toThrow(message);
  });
});
