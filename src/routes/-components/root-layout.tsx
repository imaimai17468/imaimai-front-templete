import { TanStackDevtools } from "@tanstack/react-devtools";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Header } from "@/shared/components/header/header";
import { ThemeProvider } from "@/shared/components/theme-provider/theme-provider";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";

export const RootLayout = () => {
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
