import {
  createRouter,
  createMemoryHistory,
  RouterProvider,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import type { RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { render } from "./render";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const createTestRouter = (routes: AnyRoute[], initialLocation = "/") =>
  createRouter({
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
    routeTree: rootRoute.addChildren(routes),
  });

type RenderWithRouterOptions = Omit<RenderOptions, "wrapper"> & {
  initialLocation?: string;
};

export const renderWithRouter = (
  ui: ReactElement,
  { initialLocation = "/", ...renderOptions }: RenderWithRouterOptions = {}
) => {
  const indexRoute = createRoute({
    component: () => ui,
    getParentRoute: () => rootRoute,
    path: "/",
  });

  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
  });

  const router = createTestRouter([indexRoute, catchAllRoute], initialLocation);

  const Wrapper = () => <RouterProvider router={router} />;

  return router.load().then(() => ({
    ...render(<Wrapper />, renderOptions),
    router,
  }));
};
