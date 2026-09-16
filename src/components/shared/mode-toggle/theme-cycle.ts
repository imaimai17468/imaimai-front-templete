import { Option } from "effect";

export type Theme = "dark" | "light";

const NEXT = {
  dark: "light",
  light: "dark",
} satisfies Record<Theme, Theme>;

export interface ThemeCycle {
  current: Theme;
  next: Theme;
}

const isTheme = (value: string): value is Theme => Object.hasOwn(NEXT, value);

export const resolveThemeCycle = (
  rawTheme: Option.Option<string>,
  mounted: boolean
): ThemeCycle => {
  const current = rawTheme.pipe(
    Option.filter(isTheme),
    Option.filter(() => mounted),
    Option.getOrElse((): Theme => "light")
  );
  return { current, next: NEXT[current] };
};

// next-themes hands back its persisted string, which can hold a value outside
// `Theme`.
export const needsThemeNormalization = (
  theme: Option.Option<string>
): boolean => Option.exists(theme, (value) => !isTheme(value));
