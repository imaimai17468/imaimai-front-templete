"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const isValidTheme = (t: string): t is "light" | "dark" =>
  t === "dark" || t === "light";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "light" } = useTheme();
  const resolvedTheme = isValidTheme(theme) ? theme : "light";

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
