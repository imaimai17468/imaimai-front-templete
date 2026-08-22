import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createRouterClient, type RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";
import { router } from "@/server/router";

// SSR calls the procedures in-process, so rendering never issues an HTTP request
// back to this Worker. The browser gets a real transport instead.
const getClient = createIsomorphicFn()
  .server(
    (): RouterClient<typeof router> =>
      createRouterClient(router, { context: {} })
  )
  .client(
    (): RouterClient<typeof router> =>
      createORPCClient(
        new RPCLink({ url: `${window.location.origin}/api/rpc` })
      )
  );

export const orpc = createTanstackQueryUtils(getClient());
