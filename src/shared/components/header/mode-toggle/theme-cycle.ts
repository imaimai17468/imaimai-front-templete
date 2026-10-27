export type Theme = "dark" | "light";

const isTheme = (value: string | undefined): value is Theme =>
  value === "dark" || value === "light";

const NEXT = {
  dark: "light",
  light: "dark",
} satisfies Record<Theme, Theme>;

export interface ThemeCycle {
  current: Theme;
  next: Theme;
}

const resolveCurrentTheme = (
  rawTheme: string | undefined,
  mounted: boolean
): Theme => {
  if (mounted && isTheme(rawTheme)) {
    return rawTheme;
  }
  return "light";
};

export const resolveThemeCycle = (
  rawTheme: string | undefined,
  mounted: boolean
): ThemeCycle => {
  const current = resolveCurrentTheme(rawTheme, mounted);
  return { current, next: NEXT[current] };
};

const ACTION_LABELS = {
  dark: "ライトモードに切り替え",
  light: "ダークモードに切り替え",
} satisfies Record<Theme, string>;

export const toggleLabel = (mounted: boolean, current: Theme): string => {
  if (mounted) {
    return ACTION_LABELS[current];
  }
  return "テーマを切り替え";
};

// next-themes hands back its persisted string, which can hold a value outside
// `Theme`.
export const needsThemeNormalization = (theme: string | undefined): boolean =>
  theme !== undefined && !isTheme(theme);
