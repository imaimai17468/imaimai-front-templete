/**
 * The format this page shows the registration date in.
 *
 * The zone is pinned beside the locale because a formatter otherwise takes the
 * runtime's, and workerd runs UTC while the reader's browser does not, so an
 * evening instant renders one day on the server and the next after hydration.
 */
const registeredOnFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
});

export const formatRegisteredOn = (createdAt: string): string =>
  registeredOnFormat.format(Date.parse(createdAt));
