import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useLoaderData,
} from "@tanstack/react-router";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Header } from "@/components/shared/header/header";
import { ThemeProvider } from "@/components/shared/theme-provider/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUserFn } from "@/server/fn/user";
import "@/styles.css";

if (import.meta.env.DEV && !import.meta.env.SSR) {
  void import("react-grab");
}

const RootComponent = () => {
  const { user } = useLoaderData({ from: "__root__" });
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
};

export const Route = createRootRoute({
  loader: async () => {
    const user = await getCurrentUserFn();
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
