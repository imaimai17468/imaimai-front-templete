import { Effect, Layer, Option } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  AvatarInvalidKey,
  AvatarNotFound,
  AvatarReader,
  AvatarUnauthorized,
} from "@/gateways/avatar/reader";
import { AVATAR_ROUTE_PATH } from "@/lib/avatar-url";
import type { FileRouteTypes } from "@/routeTree.gen";
import { getAvatarResponse } from "./avatars";

// The URL `avatarUrlForKey` builds is a route this app serves, and the file
// name of the route beside this test is what decides that path. Renaming one
// without the other fails to compile here.
const servedPath: FileRouteTypes["fullPaths"] = AVATAR_ROUTE_PATH;
void servedPath;

const makeFakes = () => {
  const read = vi.fn<AvatarReader["Service"]["read"]>();
  return {
    read,
    respond: (request: Request) =>
      Effect.runPromise(
        getAvatarResponse(request).pipe(
          Effect.provide(Layer.succeed(AvatarReader, AvatarReader.of({ read })))
        )
      ),
  };
};

const request = () =>
  new Request("https://example.com/api/avatars?key=user-1%2Favatar.png");

const avatarBody = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("avatar-body"));
      controller.close();
    },
  });

const errorCases = [
  [new AvatarUnauthorized(), 401, "Unauthorized"],
  [new AvatarInvalidKey(), 400, "Invalid key"],
  [new AvatarNotFound(), 404, "Not found"],
] satisfies [
  AvatarInvalidKey | AvatarNotFound | AvatarUnauthorized,
  number,
  string,
][];

const servedTypeCases = [
  ["carries a stored content type", Option.some("image/webp"), "image/webp"],
  ["carries no content type", Option.none(), "image/png"],
] satisfies [string, Option.Option<string>, string][];

describe(getAvatarResponse, () => {
  it.each(errorCases)(
    "should return the expected JSON error when authorization rejects the request",
    (failure, status, error) => {
      const { read, respond } = makeFakes();
      read.mockReturnValue(Effect.fail(failure));

      return respond(request())
        .then((response) =>
          response.json().then((body) => ({ body, status: response.status }))
        )
        .then((received) => {
          expect(received).toStrictEqual({ body: { error }, status });
        });
    }
  );

  it.each(servedTypeCases)(
    "should return hardened headers and the served type when the stored object %s",
    (_label, contentType, expectedContentType) => {
      const { read, respond } = makeFakes();
      read.mockReturnValue(Effect.succeed({ body: avatarBody(), contentType }));

      return respond(request())
        .then((response) =>
          response.text().then((body) => ({
            body,
            cacheControl: response.headers.get("Cache-Control"),
            contentSecurityPolicy: response.headers.get(
              "Content-Security-Policy"
            ),
            contentType: response.headers.get("Content-Type"),
            noSniff: response.headers.get("X-Content-Type-Options"),
            status: response.status,
          }))
        )
        .then((received) => {
          expect(received).toStrictEqual({
            body: "avatar-body",
            cacheControl: "private, max-age=31536000, immutable",
            contentSecurityPolicy: "default-src 'none'",
            contentType: expectedContentType,
            noSniff: "nosniff",
            status: 200,
          });
        });
    }
  );

  it("should pass the query string's key to the authorization boundary when the request carries one", () => {
    const { read, respond } = makeFakes();
    read.mockReturnValue(Effect.fail(new AvatarNotFound()));

    return respond(request()).then(() => {
      expect(read.mock.calls).toStrictEqual([
        [Option.some("user-1/avatar.png")],
      ]);
    });
  });

  it("should pass an absent key to the authorization boundary when the request carries no key", () => {
    const { read, respond } = makeFakes();
    read.mockReturnValue(Effect.fail(new AvatarInvalidKey()));

    return respond(new Request("https://example.com/api/avatars")).then(() => {
      expect(read.mock.calls).toStrictEqual([[Option.none()]]);
    });
  });

  it("should propagate the defect when the authorization boundary fails", () => {
    const { read, respond } = makeFakes();
    read.mockReturnValue(Effect.die(new Error("avatar read failed")));

    const result = respond(request());

    return expect(result).rejects.toThrow("avatar read failed");
  });
});
