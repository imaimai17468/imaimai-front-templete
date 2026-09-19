import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Option } from "effect";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";

// A pathless layout route, so each page nested under it is guarded by this one
// check and keeps its own URL. The route renders `<Outlet />` on its own when
// it declares no component.
export const Route = createFileRoute("/_authed")({
  // The redirect rides the error channel because that is the channel that
  // stops the pipeline and hands its value to the caller. `runPromise` rejects
  // with that value unwrapped, and the router's `isRedirect` accepts it.
  beforeLoad: ({ context }) =>
    Effect.runPromise(
      Effect.gen(function* requireSignedIn() {
        const user = yield* Effect.promise(() =>
          context.queryClient.query(currentUserQueryOptions())
        );
        return yield* Option.match(user, {
          onNone: () => Effect.fail(redirect({ to: "/login" })),
          onSome: () => Effect.void,
        });
      })
    ),
});
