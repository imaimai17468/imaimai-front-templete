import { describe, expect, it } from "vitest";
import { resolveThemeCycle } from "./ModeToggle";

describe("resolveThemeCycle", () => {
  it.each([
    { theme: "dark", label: "dark" },
    { theme: "light", label: "light" },
    { theme: undefined, label: "undefined" },
  ])(
    "should return system when not mounted and theme is $label",
    ({ theme }) => {
      expect(resolveThemeCycle(theme, false)).toEqual({
        current: "system",
        next: "light",
      });
    }
  );

  it.each([
    { theme: "light", current: "light", next: "dark" },
    { theme: "dark", current: "dark", next: "system" },
    { theme: "system", current: "system", next: "light" },
  ])(
    "should cycle to $next when mounted and theme is $theme",
    ({ theme, current, next }) => {
      expect(resolveThemeCycle(theme, true)).toEqual({ current, next });
    }
  );

  it("should fall back to system when mounted and theme is undefined", () => {
    expect(resolveThemeCycle(undefined, true)).toEqual({
      current: "system",
      next: "light",
    });
  });

  it("should fall back to system when mounted and theme is unrecognized", () => {
    expect(resolveThemeCycle("high-contrast", true)).toEqual({
      current: "system",
      next: "light",
    });
  });
});
