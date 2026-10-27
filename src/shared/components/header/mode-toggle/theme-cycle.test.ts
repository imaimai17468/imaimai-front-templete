import { describe, expect, it } from "vite-plus/test";
import { needsThemeNormalization, resolveThemeCycle } from "./theme-cycle";

describe(resolveThemeCycle, () => {
  it.each([
    { label: "dark", theme: "dark" },
    { label: "light", theme: "light" },
    { label: "none", theme: undefined },
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
    {
      current: "light",
      label: "light",
      next: "dark",
      theme: "light",
    },
    {
      current: "dark",
      label: "dark",
      next: "light",
      theme: "dark",
    },
  ])(
    "should toggle to $next when mounted and theme is $label",
    ({ theme, current, next }) => {
      expect(resolveThemeCycle(theme, true)).toStrictEqual({ current, next });
    }
  );

  it("should fall back to light when mounted and theme is none", () => {
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
    { label: "none", theme: undefined },
    { label: "light", theme: "light" },
    { label: "dark", theme: "dark" },
  ])("should return false when the theme is $label", ({ theme }) => {
    expect(needsThemeNormalization(theme)).toBeFalsy();
  });

  it.each([
    { label: "legacy system", theme: "system" },
    { label: "unrecognized", theme: "high-contrast" },
    { label: "empty string", theme: "" },
    { label: "Object.prototype key", theme: "toString" },
  ])(
    "should return true when the out-of-cycle theme is $label",
    ({ theme }) => {
      expect(needsThemeNormalization(theme)).toBeTruthy();
    }
  );
});
