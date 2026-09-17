import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { Context, Effect, Layer, Option } from "effect";
import { getAuth } from "../better-auth";
import type { Caller } from "./caller";
import { pickCaller, pickUser } from "./caller";

const readCaller = (): Promise<Option.Option<Caller>> =>
  getAuth()
    .api.getSession({ headers: getRequest().headers })
    .then((session) => pickCaller(pickUser(Option.fromNullishOr(session))));

/**
 * The caller's session, as a service.
 *
 * Reading it is an Effect so an authorization check can be driven from a test
 * layer without a session cookie, and so the check itself stays the only thing
 * under test. `None` is the signed-out request.
 */
export class CurrentSession extends Context.Service<
  CurrentSession,
  { readonly read: Effect.Effect<Option.Option<Caller>> }
>()("app/lib/auth/session/CurrentSession") {
  static readonly layer = Layer.succeed(
    CurrentSession,
    CurrentSession.of({ read: Effect.promise(readCaller) })
  );
}
