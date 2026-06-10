import { render, type RenderOptions } from "@testing-library/react";
import {
  createRouter,
  createMemoryHistory,
  RouterProvider,
  createRootRoute,
  createRoute,
  Outlet,
  type AnyRoute,
} from "@tanstack/react-router";
import type { ReactElement } from "react";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const createTestRouter = (routes: AnyRoute[], initialLocation = "/") =>
  createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
  });

type RenderWithRouterOptions = Omit<RenderOptions, "wrapper"> & {
  initialLocation?: string;
};

export const renderWithRouter = async (
  ui: ReactElement,
  { initialLocation = "/", ...renderOptions }: RenderWithRouterOptions = {}
) => {
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
  });

  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => null,
  });

  const router = createTestRouter([indexRoute, catchAllRoute], initialLocation);

  await router.load();

  const Wrapper = () => <RouterProvider router={router} />;

  const result = render(<Wrapper />, renderOptions);

  return { ...result, router };
};
