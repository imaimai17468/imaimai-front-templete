import { describe, expect, it } from "vite-plus/test";
import { dispatchToTarget, serverTargetFor } from "./server-dispatch.ts";
import type { ServerHandlers, ServerTarget } from "./server-dispatch.ts";

const ORIGIN = "http://localhost";

const requestTo = (requestPath: string, method = "GET"): Request =>
  new Request(new URL(requestPath, ORIGIN), { method });

describe(serverTargetFor, () => {
  it.each([
    ["a GET for an avatar key", "/api/avatars?key=user-1%2Favatars%2Fa.png"],
    ["a GET with no key", "/api/avatars"],
  ])(
    "should send the request to the avatar gateway when it is %s",
    (_label, requestPath) => {
      expect(serverTargetFor(requestTo(requestPath))).toBe("avatar");
    }
  );

  it("should send the request to the avatar gateway when a HEAD asks for an avatar", () => {
    expect(serverTargetFor(requestTo("/api/avatars?key=a", "HEAD"))).toBe(
      "avatar"
    );
  });

  it.each([
    ["a page", "/"],
    ["a path below the avatar path", "/api/avatars/a.png"],
    ["a path the avatar path starts", "/api/avatars-old"],
    ["Better Auth's path", "/api/auth/get-session"],
    ["a page whose query names the avatar path", "/login?next=/api/avatars"],
  ])(
    "should send the request to Start when it is a GET for %s",
    (_label, requestPath) => {
      expect(serverTargetFor(requestTo(requestPath))).toBe("start");
    }
  );

  it.each(["POST", "PUT", "DELETE"])(
    "should send the request to Start when a %s reaches the avatar path",
    (method) => {
      expect(serverTargetFor(requestTo("/api/avatars?key=a", method))).toBe(
        "start"
      );
    }
  );
});

type HandlerOptions = Parameters<ServerHandlers["start"]>[1];

type HandlerCall = readonly [ServerTarget, Request, HandlerOptions];

/** Handlers that record which of them received each request, and with what. */
const recordingHandlers = (calls: HandlerCall[]) => ({
  avatar: (request: Request, options?: HandlerOptions) => {
    calls.push(["avatar", request, options]);
    return new Response();
  },
  start: (request: Request, options?: HandlerOptions) => {
    calls.push(["start", request, options]);
    return new Response();
  },
});

describe(dispatchToTarget, () => {
  it("should hand an avatar read to the avatar handler alone when the Worker receives one", () => {
    const calls: HandlerCall[] = [];
    const request = requestTo("/api/avatars?key=a");

    void dispatchToTarget(recordingHandlers(calls))(request);

    expect(calls).toStrictEqual([["avatar", request, undefined]]);
  });

  it("should hand every other request and its options to Start alone when the Worker receives one", () => {
    const calls: HandlerCall[] = [];
    const request = requestTo("/login");
    const options = { context: {} };

    void dispatchToTarget(recordingHandlers(calls))(request, options);

    expect(calls).toStrictEqual([["start", request, options]]);
  });
});
