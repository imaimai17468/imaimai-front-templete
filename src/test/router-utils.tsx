import { render } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import {
  createRouter,
  createMemoryHistory,
  RouterProvider,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

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

export const renderWithRouter = async (
  ui: ReactElement,
  { initialLocation = "/", ...renderOptions }: RenderWithRouterOptions = {}
) => {
  const indexRoute = createRoute({
    component: () => ui,
    getParentRoute: () => rootRoute,
    path: "/",
  });

  const catchAllRoute = createRoute({
    component: () => null,
    getParentRoute: () => rootRoute,
    path: "$",
  });

  const router = createTestRouter([indexRoute, catchAllRoute], initialLocation);

  await router.load();

  const Wrapper = () => <RouterProvider router={router} />;

  const result = render(<Wrapper />, renderOptions);

  return { ...result, router };
};
