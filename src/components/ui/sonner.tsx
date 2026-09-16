"use client";

import { Option } from "effect";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

type SonnerTheme = "light" | "dark";

const isValidTheme = (t: string): t is SonnerTheme =>
  t === "dark" || t === "light";

// CSS custom properties are not part of `CSSProperties`, so the object is typed
// as an intersection that admits `--*` keys. Declaring the type is what makes it
// assignable to `style` — no assertion needed, so the value stays type-checked.
const toasterTokens: React.CSSProperties & Record<`--${string}`, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "light" } = useTheme();
  const resolvedTheme = Option.liftPredicate(theme, isValidTheme).pipe(
    Option.getOrElse((): SonnerTheme => "light")
  );

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={toasterTokens}
      {...props}
    />
  );
};

export { Toaster };
