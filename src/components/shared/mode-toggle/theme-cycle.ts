// Each theme maps to the one the toggle moves to next. A successor that is not
// itself a key here fails to compile where `resolveThemeCycle` returns it.
const NEXT = {
  dark: "light",
  light: "dark",
} as const satisfies Record<string, string>;

export type Theme = keyof typeof NEXT;

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
  const current = mounted && isTheme(rawTheme) ? rawTheme : "light";
  return { current, next: NEXT[current] };
};

// NEXT の外の永続値（旧ドロップダウンの "system" 等）を検出する。
// undefined（未解決 / 未保存）は対象外。
export const needsThemeNormalization = (theme: string | undefined): boolean =>
  theme !== undefined && !isTheme(theme);
