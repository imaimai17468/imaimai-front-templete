import { DateTime } from "effect";

/**
 * The registration date this page shows.
 *
 * The zone is pinned beside the locale because `toLocaleDateString` otherwise
 * takes the runtime's, and workerd runs UTC while the reader's browser does
 * not, so an evening instant renders one day on the server and the next after
 * hydration.
 */
export const formatRegisteredOn = (createdAt: string): string =>
  DateTime.toDateUtc(DateTime.makeUnsafe(createdAt)).toLocaleDateString(
    "ja-JP",
    { timeZone: "Asia/Tokyo" }
  );
