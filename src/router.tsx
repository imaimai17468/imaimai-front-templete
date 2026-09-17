import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  });

  const router = createTanStackRouter({
    context: { queryClient },
    defaultPreload: "intent",
    // Settled preload data is stale for the router immediately, which leaves
    // Query to decide whether a preload fetches.
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
