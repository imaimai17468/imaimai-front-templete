import { Option, Predicate, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { requireContext } from "./require-context.ts";

// `effect/noNullish` reports a written `null` or `undefined`, so a missing
// context value is built from a `None` rather than spelled out.
const absentContext = Option.none<{ id: string }>();

const readAbsentContext = () =>
  requireContext(Option.getOrNull(absentContext), "missing");

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

  it("should tag the error ContextMissing when the context is absent", () => {
    const thrown = Result.try(readAbsentContext);

    expect(
      Result.match(thrown, {
        onFailure: (error) => Predicate.isTagged(error, "ContextMissing"),
        onSuccess: () => false,
      })
    ).toBeTruthy();
  });
});
