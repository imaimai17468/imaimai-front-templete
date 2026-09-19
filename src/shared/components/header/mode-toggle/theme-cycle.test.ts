import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { needsThemeNormalization, resolveThemeCycle } from "./theme-cycle";

describe(resolveThemeCycle, () => {
  it.each([
    { label: "dark", theme: Option.some("dark") },
    { label: "light", theme: Option.some("light") },
    { label: "none", theme: Option.none() },
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
      theme: Option.some("light"),
    },
    {
      current: "dark",
      label: "dark",
      next: "light",
      theme: Option.some("dark"),
    },
  ])(
    "should toggle to $next when mounted and theme is $label",
    ({ theme, current, next }) => {
      expect(resolveThemeCycle(theme, true)).toStrictEqual({ current, next });
    }
  );

  it("should fall back to light when mounted and theme is none", () => {
    expect(resolveThemeCycle(Option.none(), true)).toStrictEqual({
      current: "light",
      next: "dark",
    });
  });

  it("should fall back to light when mounted and theme is unrecognized", () => {
    expect(resolveThemeCycle(Option.some("high-contrast"), true)).toStrictEqual(
      {
        current: "light",
        next: "dark",
      }
    );
  });
});

describe(needsThemeNormalization, () => {
  it.each([
    { label: "none", theme: Option.none() },
    { label: "light", theme: Option.some("light") },
    { label: "dark", theme: Option.some("dark") },
  ])("should return false when the theme is $label", ({ theme }) => {
    expect(needsThemeNormalization(theme)).toBeFalsy();
  });

  it.each([
    { label: "legacy system", theme: Option.some("system") },
    { label: "unrecognized", theme: Option.some("high-contrast") },
    { label: "empty string", theme: Option.some("") },
    { label: "Object.prototype key", theme: Option.some("toString") },
  ])(
    "should return true when the out-of-cycle theme is $label",
    ({ theme }) => {
      expect(needsThemeNormalization(theme)).toBeTruthy();
    }
  );
});
