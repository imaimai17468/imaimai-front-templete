"use client";

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

  // system モード廃止前に保存された localStorage の "system" など、CYCLE 外の
  // 永続値を light に正規化する（放置すると <html> に不正クラスが残る）。
  // effect はクライアントでのみ実行され undefined は needsThemeNormalization が
  // 除外するため、ここでは mounted ガード不要。resolveThemeCycle 側の mounted
  // ガードは SSR/ハイドレーション整合のため別途必要で、これとは独立。
  useEffect(() => {
    if (needsThemeNormalization(theme)) {
      setTheme("light");
    }
  }, [theme, setTheme]);

  const { current, next } = resolveThemeCycle(theme, mounted);

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
      className="min-h-11 min-w-11 aria-disabled:pointer-events-none aria-disabled:opacity-50"
      aria-label={mounted ? ACTION_LABELS[current] : "テーマを切り替え"}
    >
      <Sun className="dark:-rotate-90 size-5 rotate-0 scale-100 opacity-100 transition dark:scale-75 dark:opacity-0" />
      <Moon className="absolute size-5 rotate-90 scale-75 opacity-0 transition dark:rotate-0 dark:scale-100 dark:opacity-100" />
    </Button>
  );
};
