// @vitest-environment node

/**
 * Exercise the judgements the smoke run makes about one route's answer.
 * The process and network side lives in smoke.entry.ts and is not reached here.
 */

import { describe, expect, it } from "vite-plus/test";
import { EXPECTED_DOCUMENT_HEADERS, ROUTES } from "./smoke.expected.ts";
import {
  describeError,
  exitStatus,
  messageOf,
  pointsAt,
  missedBy,
  missingFrom,
  missingHeaders,
  readyUrlIn,
  repeatedChunking,
  report,
  served,
  signInBurstFailure,
} from "./smoke.ts";
import type { Route, RouteResult } from "./smoke.ts";

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
    expect(readyUrlIn("  ➜  Local:   http://localhost:5174/\n")).toBe(
      "http://localhost:5174/"
    );
  });

  it("should give the address when the ready line carries terminal colors", () => {
    expect(
      readyUrlIn(
        "  \u001B[32m➜\u001B[39m  \u001B[1mLocal\u001B[22m:   \u001B[36mhttp://localhost:\u001B[1m5174\u001B[22m/\u001B[39m\n"
      )
    ).toBe("http://localhost:5174/");
  });

  it("should give the local address when a network address follows it", () => {
    expect(
      readyUrlIn(
        "  ➜  Local:   http://localhost:5174/\n  ➜  Network: http://192.168.1.2:5174/\n"
      )
    ).toBe("http://localhost:5174/");
  });

  it("should give no address when the text holds no ready line", () => {
    expect(
      readyUrlIn("[void] Applied 1 migration(s): 20261120155350_init.sql\n")
    ).toBeNull();
  });

  it("should give the message when an Error was thrown", () => {
    expect(messageOf(new Error("socket hang up"))).toBe("socket hang up");
  });

  it("should report the record as this run's when it names the run's directory", () => {
    expect(
      pointsAt(
        '{"version":1,"persistRoot":"/tmp/app-smoke-1"}',
        "/tmp/app-smoke-1"
      )
    ).toBeTruthy();
  });

  it.each([
    ["another directory", '{"persistRoot":"/repo/.void"}'],
    ["no persistRoot", '{"version":1}'],
    ["no record", ""],
    ["text that is not JSON", "{"],
  ])(
    "should not report the record as this run's when it holds %s",
    (_label, recordText) => {
      expect(pointsAt(recordText, "/tmp/app-smoke-1")).toBeFalsy();
    }
  );

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

  it("should name the framing when the answer is chunked twice", () => {
    expect(
      missedBy("", new Headers({ "transfer-encoding": "chunked, chunked" }), {
        ...ROUTE,
        marker: null,
      })
    ).toStrictEqual(["Transfer-Encoding: chunked once (got chunked, chunked)"]);
  });

  it("should name every miss at once when the answer lacks the marker, the redirect target and a header", () => {
    const route: Route = {
      headers: { "X-Frame-Options": "DENY" },
      location: "/login",
      marker: "Sign in",
      path: "/login",
      status: 200,
    };

    expect(missedBy("<html></html>", new Headers(), route)).toStrictEqual([
      "Sign in",
      "location /login",
      "X-Frame-Options: DENY",
    ]);
  });

  it("should not check the redirect target when the route names none", () => {
    expect(
      missedBy("<html>Sign in</html>", new Headers({ location: "/" }), ROUTE)
    ).toStrictEqual([]);
  });

  it.each(["chunked", "gzip, chunked", "gzip"])(
    "should find nothing missing when the answer's transfer coding is %s",
    (encoding) => {
      expect(
        repeatedChunking(new Headers({ "transfer-encoding": encoding }))
      ).toStrictEqual([]);
    }
  );

  it("should find nothing missing when the answer carries no transfer coding", () => {
    expect(repeatedChunking(new Headers())).toStrictEqual([]);
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

  it("should request every page route, the favicon and the avatar path when the smoke run boots the Worker", () => {
    expect(ROUTES.map((route) => route.path)).toStrictEqual([
      "/",
      "/login",
      "/login?error=access_denied",
      "/favicon.svg",
      "/profile",
      "/api/avatars",
    ]);
  });

  it.each([
    ["the table is missing", [500, 500, 500, 500]],
    ["the table cannot read back its row", [400, 429, 429, 429]],
    ["the limiter is off", [400, 400, 400, 400]],
    ["the first sign-in fails", [500, 400, 400, 429]],
    ["a sign-in within the limit fails above 500", [400, 503, 400, 429]],
    ["the sign-in over the limit fails", [400, 400, 400, 500]],
  ])("should report the burst when %s", (_label, statuses) => {
    expect(signInBurstFailure(statuses)).toBe(
      `/api/auth/sign-in/email answered ${statuses.join(" ")} to 4 sign-ins from one address, where 3 answers below 500 other than 429 and then a 429 were expected`
    );
  });

  it.each([
    ["the same client error", [400, 400, 400, 429]],
    ["client errors other than 429", [400, 415, 499, 429]],
  ])(
    "should report nothing when the sign-ins within the limit answer %s and the fourth is limited",
    (_label, statuses) => {
      expect(signInBurstFailure(statuses)).toBeNull();
    }
  );
});

describe(describeError, () => {
  it("should name each cause after the message when the error wraps causes", () => {
    expect(
      describeError(
        new Error("could not start", {
          cause: new Error("spawn bunx", { cause: "ENOENT" }),
        })
      )
    ).toBe("could not start: spawn bunx: ENOENT");
  });

  it("should print the message alone when the error has no cause", () => {
    expect(describeError(new Error("not ready"))).toBe("not ready");
  });

  it("should print the value when what was thrown is not an error", () => {
    expect(describeError(null)).toBe("null");
  });
});

describe(exitStatus, () => {
  it("should exit with the run's result when no signal interrupted it", () => {
    expect(exitStatus(1, [])).toBe(1);
  });

  it("should exit as a shell reports the first signal when signals interrupted the run", () => {
    expect(exitStatus(1, [2, 15])).toBe(130);
  });
});
