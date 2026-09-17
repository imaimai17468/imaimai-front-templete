import "@tanstack/react-start/server-only";
import { Effect } from "effect";

/**
 * The platform's random identifier, as the avatar key's uniqueness source.
 *
 * `crypto` crosses no further than this module. Effect's own `Random` reaches
 * the same global for its seed, so nothing in this runtime supplies
 * cryptographic randomness without it, and the value has to be unguessable
 * because it names a bucket object.
 */
export const randomAvatarKeyId: Effect.Effect<string> = Effect.sync(() =>
  crypto.randomUUID()
);
