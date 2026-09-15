import { Context, Effect, Layer } from "effect";
import { getSession } from "./session.live";

/**
 * The caller's session, as a service.
 *
 * Reading it is an Effect so an authorization check can be driven from a test
 * layer without a session cookie, and so the check itself stays the only thing
 * under test.
 */
export class CurrentSession extends Context.Service<
  CurrentSession,
  { readonly read: Effect.Effect<Awaited<ReturnType<typeof getSession>>> }
>()("app/lib/auth/CurrentSession") {
  static readonly layer = Layer.succeed(
    CurrentSession,
    CurrentSession.of({ read: Effect.promise(async () => await getSession()) })
  );
}
