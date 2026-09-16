import { Option } from "effect";

export type Theme = "dark" | "light";

// Each theme maps to the one the toggle moves to next. `Record<Theme, Theme>`
// is what makes a successor outside the union fail to compile here, rather
// than where `resolveThemeCycle` returns it.
const NEXT = {
  dark: "light",
  light: "dark",
} satisfies Record<Theme, Theme>;

export interface ThemeCycle {
  current: Theme;
  next: Theme;
}

const isTheme = (value: string): value is Theme => value in NEXT;

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

// 旧ドロップダウンの "system" など、NEXT の外の永続値を検出する。
export const needsThemeNormalization = (
  theme: Option.Option<string>
): boolean => Option.exists(theme, (value) => !isTheme(value));
