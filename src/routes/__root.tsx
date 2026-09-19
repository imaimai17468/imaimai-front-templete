import { TanStackDevtools } from "@tanstack/react-devtools";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Header } from "@/components/shared/header/header";
import { ThemeProvider } from "@/components/shared/theme-provider/theme-provider";
import { DOCUMENT_HEADERS } from "@/lib/response-headers";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import "@/styles.css";

if (import.meta.env.DEV && !import.meta.env.SSR) {
  void import("react-grab");
}

const RootComponent = () => {
  const { data: user } = useSuspenseQuery(currentUserQueryOptions());
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex min-h-dvh flex-col gap-16">
              <Header user={user} />
              <div className="flex w-full flex-1 justify-center px-6 md:px-4">
                <div className="container">
                  <Outlet />
                </div>
              </div>
            </div>
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
        <TanStackDevtools
          plugins={[
            {
              name: "TanStack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  loader: ({ context }) => context.queryClient.query(currentUserQueryOptions()),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "imaimai-front-templete" },
    ],
  }),
  headers: () => DOCUMENT_HEADERS,
  component: RootComponent,
  notFoundComponent: () => <p>ページが見つかりません</p>,
});
