import { describe, expectTypeOf, it } from "vite-plus/test";
import type { AVATAR_ROUTE_PATH } from "@/lib/avatar-url";
import type { FileRouteTypes } from "@/routeTree.gen";

describe("/api/avatars", () => {
  // The route beside this test serves the path its file name gives it, so
  // renaming that file without changing AVATAR_ROUTE_PATH fails to compile
  // here.
  it("should be the path avatarUrlForKey builds when the route file keeps its name", () => {
    expectTypeOf<typeof AVATAR_ROUTE_PATH>().toExtend<
      FileRouteTypes["fullPaths"]
    >();
  });
});
