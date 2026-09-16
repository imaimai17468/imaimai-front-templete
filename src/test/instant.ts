import { DateTime } from "effect";

/**
 * The `Date` a fixture pins an instant to.
 *
 * Better Auth's session type carries `Date`, and building one from an ISO
 * string through `DateTime` keeps the clock out of the fixture.
 */
export const instant = (iso: string): Date =>
  DateTime.toDateUtc(DateTime.makeUnsafe(iso));
