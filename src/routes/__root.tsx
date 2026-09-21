import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext } from "@tanstack/react-router";
import { DOCUMENT_HEADERS } from "@/lib/response-headers";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { NotFound } from "./-components/not-found";
import { RootLayout } from "./-components/root-layout";
import "@/styles.css";

if (import.meta.env.DEV && !import.meta.env.SSR) {
  void import("react-grab");
}

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
    // The SVG carries both themes in its own media query, so one file answers
    // the light and the dark tab strip.
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  headers: () => DOCUMENT_HEADERS,
  component: RootLayout,
  notFoundComponent: NotFound,
});
