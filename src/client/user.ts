import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "./orpc";

export const currentUserQueryOptions = () => orpc.user.current.queryOptions();

// fetchQuery, not ensureQueryData: the latter resolves with cached data without
// awaiting a refetch, so a route guard built on it keeps admitting a visitor
// whose session already ended. The default staleTime of 0 makes this refetch on
// every call. Query-core only dedupes callers whose fetches overlap in time, and
// the router awaits every beforeLoad before starting any loader, so a /profile
// navigation still issues one request from the guard and one from the root
// loader — this layer does not remove that.
export const fetchCurrentUser = async (queryClient: QueryClient) =>
  queryClient.fetchQuery(currentUserQueryOptions());
