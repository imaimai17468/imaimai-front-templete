import { createFileRoute, redirect } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";

// A pathless layout route, so each page nested under it is guarded by this one
// check and keeps its own URL. The route renders `<Outlet />` on its own when
// it declares no component.
export const Route = createFileRoute("/_authed")({
  beforeLoad: ({ context }) =>
    context.queryClient.query(currentUserQueryOptions()).then((user) => {
      if (user === null) {
        redirect({ throw: true, to: "/login" });
      }
    }),
});
