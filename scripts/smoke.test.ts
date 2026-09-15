// @vitest-environment node

/**
 * Exercise the judgements the smoke run makes about one route's answer.
 * The process and network side lives in smoke.entry.ts and is not reached here.
 */

import { describe, expect, it } from "vite-plus/test";
import {
  messageOf,
  missingFrom,
  readyUrlIn,
  report,
  ROUTES,
  served,
} from "./smoke";
import type { Route, RouteResult } from "./smoke";

const ROUTE: Route = { marker: "Sign in", path: "/login", status: 200 };

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
      readyUrlIn("[wrangler:info] Ready on http://localhost:53402\n")
    ).toBe("http://localhost:53402");
  });

  it("should give no address when the text holds no ready line", () => {
    expect(readyUrlIn("⎔ Starting local server...\n")).toBeNull();
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

  it("should request / and /login when the smoke run boots the Worker", () => {
    expect(ROUTES.map((route) => route.path)).toStrictEqual(["/", "/login"]);
  });
});
