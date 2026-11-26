/** What a query function receives that a server function also reads. */
interface QuerySignal {
  readonly signal: AbortSignal;
}

/**
 * A `queryFn` that calls `serverFn` with the query's `signal`, so a cancelled
 * query cancels the request rather than leaving it running.
 */
export const serverFnQuery =
  <A>(serverFn: (options: QuerySignal) => Promise<A>) =>
  ({ signal }: QuerySignal): Promise<A> =>
    serverFn({ signal });

/**
 * A `queryFn` that calls `serverFn`, one that takes input through its
 * validator, with `data` and the query's `signal`.
 *
 * @public
 */
export const serverFnQueryWith =
  <D, A>(
    serverFn: (options: QuerySignal & { readonly data: D }) => Promise<A>,
    data: D
  ) =>
  ({ signal }: QuerySignal): Promise<A> =>
    serverFn({ data, signal });
