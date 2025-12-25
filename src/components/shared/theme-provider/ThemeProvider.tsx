"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * アプリケーション全体のテーマ管理を提供するプロバイダーコンポーネント
 * next-themesを使用してダークモード/ライトモードの切り替えを実現
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
