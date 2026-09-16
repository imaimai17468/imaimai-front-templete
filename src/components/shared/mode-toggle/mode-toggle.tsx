"use client";

import { Match, Option } from "effect";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { needsThemeNormalization, resolveThemeCycle } from "./theme-cycle";
import type { Theme } from "./theme-cycle";

const ACTION_LABELS = {
  dark: "ライトモードに切り替え",
  light: "ダークモードに切り替え",
} satisfies Record<Theme, string>;

// ハイドレーション検出用。購読対象の外部システムは存在しないため subscribe は
// 何も通知しない。サーバスナップショット false がそのまま SSR ガードになる。
const emptySubscribe = () => () => {
  /* empty */
};

export const ModeToggle = () => {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  useEffect(() => {
    if (needsThemeNormalization(Option.fromUndefinedOr(theme))) {
      setTheme("light");
    }
  }, [theme, setTheme]);

  const { current, next } = resolveThemeCycle(
    Option.fromUndefinedOr(theme),
    mounted
  );

  const toggleTheme = useCallback(() => {
    if (mounted) {
      setTheme(next);
    }
  }, [mounted, next, setTheme]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-disabled={!mounted}
      className="min-h-11 min-w-11 aria-disabled:pointer-events-none"
      aria-label={Match.value(mounted).pipe(
        Match.when(true, () => ACTION_LABELS[current]),
        Match.when(false, () => "テーマを切り替え"),
        Match.exhaustive
      )}
    >
      <Sun className="size-5 scale-100 rotate-0 opacity-100 transition dark:scale-75 dark:-rotate-90 dark:opacity-0" />
      <Moon className="absolute size-5 scale-75 rotate-90 opacity-0 transition dark:scale-100 dark:rotate-0 dark:opacity-100" />
    </Button>
  );
};
