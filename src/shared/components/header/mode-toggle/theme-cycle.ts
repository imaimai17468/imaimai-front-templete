import { Option, Schema } from "effect";

const ThemeSchema = Schema.Literals(["dark", "light"]);

export type Theme = typeof ThemeSchema.Type;

const decodeTheme = Schema.decodeUnknownOption(ThemeSchema);

const NEXT = {
  dark: "light",
  light: "dark",
} satisfies Record<Theme, Theme>;

export interface ThemeCycle {
  current: Theme;
  next: Theme;
}

export const resolveThemeCycle = (
  rawTheme: Option.Option<string>,
  mounted: boolean
): ThemeCycle => {
  const current = rawTheme.pipe(
    Option.flatMap(decodeTheme),
    Option.filter(() => mounted),
    Option.getOrElse((): Theme => "light")
  );
  return { current, next: NEXT[current] };
};

// next-themes hands back its persisted string, which can hold a value outside
// `Theme`.
export const needsThemeNormalization = (
  theme: Option.Option<string>
): boolean =>
  Option.exists(theme, (value) => Option.isNone(decodeTheme(value)));
