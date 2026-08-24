import { describe, expect, it } from "vitest";
import { needsThemeNormalization, resolveThemeCycle } from "./mode-toggle";

describe(resolveThemeCycle, () => {
  it.each([
    { label: "dark", theme: "dark" },
    { label: "light", theme: "light" },
    { label: "undefined", theme: undefined },
  ])(
    "should default to light when not mounted and theme is $label",
    ({ theme }) => {
      expect(resolveThemeCycle(theme, false)).toStrictEqual({
        current: "light",
        next: "dark",
      });
    }
  );

  it.each([
    { current: "light", next: "dark", theme: "light" },
    { current: "dark", next: "light", theme: "dark" },
  ])(
    "should toggle to $next when mounted and theme is $theme",
    ({ theme, current, next }) => {
      expect(resolveThemeCycle(theme, true)).toStrictEqual({ current, next });
    }
  );

  it("should fall back to light when mounted and theme is undefined", () => {
    expect(resolveThemeCycle(undefined, true)).toStrictEqual({
      current: "light",
      next: "dark",
    });
  });

  it("should fall back to light when mounted and theme is unrecognized", () => {
    expect(resolveThemeCycle("high-contrast", true)).toStrictEqual({
      current: "light",
      next: "dark",
    });
  });
});

describe(needsThemeNormalization, () => {
  it.each([
    { label: "undefined", theme: undefined },
    { label: "light", theme: "light" },
    { label: "dark", theme: "dark" },
  ])("should return false for supported theme $label", ({ theme }) => {
    expect(needsThemeNormalization(theme)).toBeFalsy();
  });

  it.each([
    { label: "legacy system", theme: "system" },
    { label: "unrecognized", theme: "high-contrast" },
    { label: "empty string", theme: "" },
  ])("should return true for out-of-cycle theme $label", ({ theme }) => {
    expect(needsThemeNormalization(theme)).toBeTruthy();
  });
});
