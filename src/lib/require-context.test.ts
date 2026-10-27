import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { requireContext } from "./require-context";

// `effect/noNullish` reports a written `null` or `undefined`, so a missing
// context value is built from a `None` rather than spelled out.
const absentContext = Option.none<{ id: string }>();

describe(requireContext, () => {
  it("should return the value when the provider supplied one", () => {
    const value = { id: "form-item" };

    const result = requireContext(value, "missing");

    expect(result).toBe(value);
  });

  it.each([
    { absence: "null", value: Option.getOrNull(absentContext) },
    { absence: "undefined", value: Option.getOrUndefined(absentContext) },
  ])(
    "should raise the given message when the context is $absence",
    ({ value }) => {
      const message = "should be used within <FormField>";

      const read = () => requireContext(value, message);

      expect(read).toThrow(message);
    }
  );
});
