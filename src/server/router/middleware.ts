import { os } from "@orpc/server";
import { fetchCurrentUser } from "@/gateways/user";
import { getSession } from "@/lib/auth/session";

// Resolution lives here, inside the procedure chain, rather than in Hono
// middleware: the SSR path reaches procedures through createRouterClient without
// passing through Hono, so anything installed only on the HTTP layer would not
// run for it. specs/server-boundary.spec.md is the design this implements.
export const withUser = os
  .$context<Record<never, never>>()
  .middleware(async ({ next }) => {
    const session = await getSession();
    const user = session?.user
      ? await fetchCurrentUser(session.user.id, session.user.email)
      : null;
    return next({ context: { user } });
  });
