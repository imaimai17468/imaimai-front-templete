/**
 * How the smoke run judges each route's answer and reports it.
 * `smoke.expected.ts` holds the routes it requests and what each must answer, and
 * `smoke.entry.ts` the process and network side.
 */

import { stripVTControlCharacters } from "node:util";
import { Option, Schema } from "effect";

/** The tag a whole HTML response ends with, so a truncated one lacks it. */
const CLOSING_TAG = "</html>";

export interface Route {
  /** Response headers the answer must carry, by name, with the exact value. */
  readonly headers: Readonly<Record<string, string>>;
  /**
   * Text only this route's own component renders, or null where the answer
   * carries no body, as a redirect's does not.
   */
  readonly marker: string | null;
  /** Where a redirect must point, or null where the answer carries no body. */
  readonly location: string | null;
  readonly path: string;
  readonly status: number;
}

/**
 * The sign-in burst the run sends from one address after the routes.
 * better-auth limits `/sign-in` paths to three requests per ten seconds unless
 * `rateLimit.customRules` says otherwise. Written out here rather than read
 * from `src/`, so a change to the limit has to be made on this side too.
 */
export const SIGN_IN_BURST = {
  allowed: 3,
  path: "/api/auth/sign-in/email",
};

/**
 * What the run reports where the burst's answers show the limiter off or
 * broken, or null where it limited as configured. Every answer within the limit
 * has to be below 500 and other than 429, and the one after it 429: a missing
 * `rate_limits` table answers 500 throughout, a table the adapter cannot read
 * back answers 429 from the second request, and a limiter that is off never
 * answers 429.
 */
export const signInBurstFailure = (
  statuses: readonly number[]
): string | null => {
  const withinLimit = statuses.slice(0, SIGN_IN_BURST.allowed);
  const overLimit = statuses[SIGN_IN_BURST.allowed];
  const limited =
    withinLimit.every((status) => status < 500 && status !== 429) &&
    overLimit === 429;
  return limited
    ? null
    : `${SIGN_IN_BURST.path} answered ${statuses.join(" ")} to ${SIGN_IN_BURST.allowed + 1} sign-ins from one address, where ${SIGN_IN_BURST.allowed} answers below 500 other than 429 and then a 429 were expected`;
};

export type RouteResult =
  | {
      readonly expectedStatus: number;
      readonly kind: "answered";
      readonly missing: readonly string[];
      readonly path: string;
      readonly status: number;
    }
  | {
      readonly kind: "unanswered";
      readonly path: string;
      readonly reason: string;
    };

export const missingFrom = (body: string, route: Route): readonly string[] =>
  route.marker === null
    ? []
    : [CLOSING_TAG, route.marker].filter((needle) => !body.includes(needle));

/** The headers the route names that the answer did not carry with that value. */
export const missingHeaders = (
  headers: Headers,
  route: Route
): readonly string[] =>
  Object.entries(route.headers)
    .filter(([name, value]) => headers.get(name) !== value)
    .map(([name, value]) => `${name}: ${value}`);

/**
 * The single chunked framing, where the answer was chunked more than once.
 * `fetch` reads repeated `Transfer-Encoding` lines as one joined value, and
 * portless forwards them joined the same way, as `chunked, chunked`, which
 * Chrome refuses and answers with an error page.
 */
export const repeatedChunking = (headers: Headers): readonly string[] => {
  const encoding = headers.get("transfer-encoding");
  if (encoding === null) {
    return [];
  }
  const chunkings = encoding
    .split(",")
    .filter((coding) => coding.trim().toLowerCase() === "chunked");
  return chunkings.length > 1
    ? [`Transfer-Encoding: chunked once (got ${encoding})`]
    : [];
};

/**
 * What the answer failed to carry: the body's markers, the redirect target
 * where the route names one, the headers it names, and framing chunked only
 * once. One list so `report` prints every miss at once.
 */
export const missedBy = (
  body: string,
  headers: Headers,
  route: Route
): readonly string[] => [
  ...missingFrom(body, route),
  ...(route.location === null || route.location === headers.get("location")
    ? []
    : [`location ${route.location}`]),
  ...missingHeaders(headers, route),
  ...repeatedChunking(headers),
];

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const READY_LINE = /Local:\s+(?<url>http:\/\/\S+)/u;

/**
 * The address the dev server prints once it listens, or null while the text
 * holds no such line. The terminal colors come off first, because the pattern
 * would read their escape codes as part of the address.
 */
export const readyUrlIn = (lines: string): string | null =>
  READY_LINE.exec(stripVTControlCharacters(lines))?.groups?.url ?? null;

export const served = (result: RouteResult): boolean =>
  result.kind === "answered" &&
  result.status === result.expectedStatus &&
  result.missing.length === 0;

export const report = (result: RouteResult): string => {
  if (result.kind === "unanswered") {
    return `${result.path} -> no response (${result.reason})`;
  }
  const missing =
    result.missing.length === 0
      ? ""
      : `, missing ${result.missing.join(" and ")}`;
  return `${result.path} -> ${result.status} (expected ${result.expectedStatus}${missing})`;
};

const decodeLocalD1Record = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))
);

/**
 * Whether the record `voidPlugin({ persistTo })` writes for the `void db` CLI
 * still names `dir`. A run that pointed it at its own directory leaves the
 * CLI aimed at a directory that no longer exists.
 */
export const pointsAt = (recordText: string, dir: string): boolean =>
  decodeLocalD1Record(recordText).pipe(
    Option.exists((record) => record.persistRoot === dir)
  );
