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

const isTheme = (value: string | undefined): value is Theme =>
  value !== undefined && value in NEXT;

export const resolveThemeCycle = (
  rawTheme: string | undefined,
  mounted: boolean
): ThemeCycle => {
  const current = Option.liftPredicate(rawTheme, isTheme).pipe(
    Option.filter(() => mounted),
    Option.getOrElse((): Theme => "light")
  );
  return { current, next: NEXT[current] };
};

// NEXT の外の永続値（旧ドロップダウンの "system" 等）を検出する。
// undefined（未解決 / 未保存）は対象外。
export const needsThemeNormalization = (theme: string | undefined): boolean =>
  theme !== undefined && !isTheme(theme);
