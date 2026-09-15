/**
 * What the smoke run asks of each route and how it reports the answer.
 * `smoke.entry.ts` holds the process and network side.
 */

/** The tag a whole HTML response ends with, so a truncated one lacks it. */
const CLOSING_TAG = "</html>";

export interface Route {
  /** Text only this route's own component renders. */
  readonly marker: string;
  readonly path: string;
  readonly status: number;
}

/** What the smoke run requests, and what each route's answer must hold. */
export const ROUTES: readonly Route[] = [
  { marker: "docs/SERVER_BOUNDARY.md", path: "/", status: 200 },
  { marker: "Sign in With Google", path: "/login", status: 200 },
];

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
  [CLOSING_TAG, route.marker].filter((needle) => !body.includes(needle));

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const READY_LINE = /Ready on (?<url>http:\/\/\S+)$/mu;

/**
 * The address wrangler prints once workerd listens, or null while the text
 * holds no such line. Matching to end of line keeps a URL that a stdout chunk
 * cut in half from being read as the whole address.
 */
export const readyUrlIn = (lines: string): string | null =>
  READY_LINE.exec(lines)?.groups?.url ?? null;

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
