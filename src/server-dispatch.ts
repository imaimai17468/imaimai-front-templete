import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";
import { AVATAR_ROUTE_PATH } from "@/shared/gateway/user/avatar-url";

/** Which handler answers a request the Worker receives. */
export type ServerTarget = "avatar" | "start";

export type ServerHandlers = Readonly<
  Record<ServerTarget, RequestHandler<Register>>
>;

const AVATAR_READ_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

/**
 * `avatar` for a GET or HEAD whose path is `AVATAR_ROUTE_PATH`, which the
 * avatar gateway answers in place of Start's handler, so no request middleware
 * registered with `createStart` runs for it, and `start` for every other
 * request.
 */
export const serverTargetFor = (request: Request): ServerTarget => {
  const readsAvatar =
    AVATAR_READ_METHODS.has(request.method) &&
    new URL(request.url).pathname === AVATAR_ROUTE_PATH;
  if (readsAvatar) {
    return "avatar";
  }
  return "start";
};

/** The fetch handler that hands each request to the handler its target names. */
export const dispatchToTarget =
  (handlers: ServerHandlers): RequestHandler<Register> =>
  (request, options) =>
    handlers[serverTargetFor(request)](request, options);
