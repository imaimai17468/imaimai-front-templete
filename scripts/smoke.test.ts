// @vitest-environment node

/**
 * Exercise the judgements the smoke run makes about one route's answer.
 * The process and network side lives in smoke.entry.ts and is not reached here.
 */

import { describe, expect, it } from "vite-plus/test";
import {
  addedSince,
  EXPECTED_DOCUMENT_HEADERS,
  messageOf,
  missedBy,
  missingFrom,
  missingHeaders,
  readyUrlIn,
  report,
  ROUTES,
  served,
  signInBurstFailure,
} from "./smoke";
import type { Route, RouteResult } from "./smoke";

const ROUTE: Route = {
  headers: {},
  location: null,
  marker: "Sign in",
  path: "/login",
  status: 200,
};

const answered = (
  overrides: Partial<Extract<RouteResult, { kind: "answered" }>> = {}
): RouteResult => ({
  expectedStatus: 200,
  kind: "answered",
  missing: [],
  path: "/login",
  status: 200,
  ...overrides,
});

const unanswered: RouteResult = {
  kind: "unanswered",
  path: "/login",
  reason: "timed out",
};

describe("smoke", () => {
  it("should find nothing missing when the body closes the document and holds the marker", () => {
    expect(missingFrom("<html>Sign in</html>", ROUTE)).toStrictEqual([]);
  });

  it("should find the closing tag missing when the body is cut short", () => {
    expect(missingFrom("<html>Sign in", ROUTE)).toStrictEqual(["</html>"]);
  });

  it("should find the marker missing when the route's own content is absent", () => {
    expect(missingFrom("<html>elsewhere</html>", ROUTE)).toStrictEqual([
      "Sign in",
    ]);
  });

  it("should give the address when a complete ready line is present", () => {
    expect(
      readyUrlIn(
        "[23:14:54.358] INFO (#374): [app] ready at http://localhost:53402\n"
      )
    ).toBe("http://localhost:53402");
  });

  it("should give no address when the text holds no ready line", () => {
    expect(
      readyUrlIn("[23:14:30.118] INFO (#19): [db] create (local)\n")
    ).toBeNull();
  });

  it("should give only the new entries when the second listing adds to the first", () => {
    expect(addedSince(["a", "b"], ["a", "b", "c"])).toStrictEqual(["c"]);
  });

  it("should give the message when an Error was thrown", () => {
    expect(messageOf(new Error("socket hang up"))).toBe("socket hang up");
  });

  it("should give the string form when a non-Error was thrown", () => {
    expect(messageOf("socket hang up")).toBe("socket hang up");
  });

  it("should count a route as served when it answered with the expected status and a whole body", () => {
    expect(served(answered())).toBeTruthy();
  });

  it("should not count a route as served when it did not answer", () => {
    expect(served(unanswered)).toBeFalsy();
  });

  it("should not count a route as served when the status differs from the expected one", () => {
    expect(served(answered({ status: 500 }))).toBeFalsy();
  });

  it("should not count a route as served when the body lacks what the route must render", () => {
    expect(served(answered({ missing: ["</html>"] }))).toBeFalsy();
  });

  it("should name the reason when the route did not answer", () => {
    expect(report(unanswered)).toBe("/login -> no response (timed out)");
  });

  it("should name the status and the expected one when the body is whole", () => {
    expect(report(answered({ status: 500 }))).toBe(
      "/login -> 500 (expected 200)"
    );
  });

  it("should name every missing part when the body lacks more than one", () => {
    expect(report(answered({ missing: ["</html>", "Sign in"] }))).toBe(
      "/login -> 200 (expected 200, missing </html> and Sign in)"
    );
  });

  it("should find nothing missing when the route answers without a body", () => {
    const redirectRoute: Route = {
      headers: {},
      location: null,
      marker: null,
      path: "/profile",
      status: 307,
    };

    expect(missingFrom("", redirectRoute)).toStrictEqual([]);
  });

  it("should find the redirect target missing when the answer points elsewhere", () => {
    const guarded: Route = {
      headers: {},
      location: "/login",
      marker: null,
      path: "/profile",
      status: 307,
    };

    expect(missedBy("", new Headers({ location: "/" }), guarded)).toStrictEqual(
      ["location /login"]
    );
  });

  it("should find nothing missing when the redirect points where the route names", () => {
    const guarded: Route = {
      headers: {},
      location: "/login",
      marker: null,
      path: "/profile",
      status: 307,
    };

    expect(
      missedBy("", new Headers({ location: "/login" }), guarded)
    ).toStrictEqual([]);
  });

  it("should find nothing missing when the answer carries every header the route names", () => {
    const route: Route = { ...ROUTE, headers: EXPECTED_DOCUMENT_HEADERS };

    expect(
      missingHeaders(new Headers(EXPECTED_DOCUMENT_HEADERS), route)
    ).toStrictEqual([]);
  });

  it("should name the header when the answer omits one the route requires", () => {
    const route: Route = { ...ROUTE, headers: EXPECTED_DOCUMENT_HEADERS };
    const withoutFrameOptions = new Headers(EXPECTED_DOCUMENT_HEADERS);
    withoutFrameOptions.delete("X-Frame-Options");

    expect(missingHeaders(withoutFrameOptions, route)).toStrictEqual([
      "X-Frame-Options: DENY",
    ]);
  });

  it("should name the header when the answer carries another value for it", () => {
    const route: Route = {
      ...ROUTE,
      headers: { "Cache-Control": "private, no-store" },
    };

    expect(
      missingHeaders(new Headers({ "Cache-Control": "public" }), route)
    ).toStrictEqual(["Cache-Control: private, no-store"]);
  });

  it("should require the document headers when the route is a rendered page", () => {
    expect(
      ROUTES.filter((route) => route.marker !== null).map(
        (route) => route.headers
      )
    ).toStrictEqual([
      EXPECTED_DOCUMENT_HEADERS,
      EXPECTED_DOCUMENT_HEADERS,
      EXPECTED_DOCUMENT_HEADERS,
    ]);
  });

  it("should request every page route and the favicon when the smoke run boots the Worker", () => {
    expect(ROUTES.map((route) => route.path)).toStrictEqual([
      "/",
      "/login",
      "/auth/auth-code-error",
      "/favicon.svg",
      "/profile",
    ]);
  });

  it.each([
    ["the table is missing", [500, 500, 500, 500]],
    ["the table cannot read back its row", [400, 429, 429, 429]],
    ["the limiter is off", [400, 400, 400, 400]],
  ])("should report the burst when %s", (_label, statuses) => {
    expect(signInBurstFailure(statuses)).toBe(
      `/api/auth/sign-in/email answered ${statuses.join(" ")} to 4 sign-ins from one address, where 3 answers below 500 other than 429 and then a 429 were expected`
    );
  });

  it("should report nothing when the fourth sign-in is the first one limited", () => {
    expect(signInBurstFailure([400, 400, 400, 429])).toBeNull();
  });
});
