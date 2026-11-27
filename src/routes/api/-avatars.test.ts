import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import type { FileRouteTypes } from "@/routeTree.gen";
import type { AVATAR_ROUTE_PATH } from "@/shared/gateway/user/avatar-url";
import { serveAvatar } from "@/shared/gateway/user/avatar/read";
import { Route } from "./avatars.ts";

describe("/api/avatars", () => {
  // The route beside this test serves the path its file name gives it, so
  // renaming that file without changing AVATAR_ROUTE_PATH fails to compile
  // here.
  it("should be the path avatarUrlForKey builds when the route file keeps its name", () => {
    expectTypeOf<typeof AVATAR_ROUTE_PATH>().toExtend<
      FileRouteTypes["fullPaths"]
    >();
  });

  it("should give TanStack Start serveAvatar as the GET handler when it looks up the route's handlers", () => {
    expect(Route.options.server?.handlers).toStrictEqual({ GET: serveAvatar });
  });
});
