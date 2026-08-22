import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Header } from "@/components/shared/header/Header";
import { ThemeProvider } from "@/components/shared/theme-provider/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { fetchCurrentUser } from "@/client/user";
import "@/styles.css";

if (import.meta.env.DEV && !import.meta.env.SSR) {
  void import("react-grab");
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  loader: async ({ context }) => {
    const user = await fetchCurrentUser(context.queryClient);
    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "imaimai-front-templete" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => <p>ページが見つかりません</p>,
});

function RootComponent() {
  const { user } = Route.useLoaderData();
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className="antialiased"
        style={{
          fontFamily:
            '"Hiragino Kaku Gothic ProN", "ヒラギノ角ゴ ProN W3", "Hiragino Kaku Gothic Pro", "ヒラギノ角ゴ Pro W3", "メイリオ", Meiryo, "游ゴシック", YuGothic, sans-serif',
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="flex min-h-dvh flex-col gap-16">
            <Header user={user} />
            <div className="flex w-full flex-1 justify-center px-6 md:px-4">
              <div className="container w-full">
                <Outlet />
              </div>
            </div>
          </div>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
