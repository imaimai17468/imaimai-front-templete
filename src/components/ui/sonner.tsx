"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const isValidTheme = (t: string): t is NonNullable<ToasterProps["theme"]> =>
  t === "dark" || t === "light" || t === "system";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const resolvedTheme = isValidTheme(theme) ? theme : "system";

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties // oxlint-disable-line no-unsafe-type-assertion -- CSS custom properties not in CSSProperties type
      }
      {...props}
    />
  );
};

export { Toaster };
