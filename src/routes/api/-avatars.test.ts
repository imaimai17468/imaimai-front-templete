import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { AVATAR_ROUTE_PATH } from "@/lib/avatar-url";
import type { FileRouteTypes } from "@/routeTree.gen";
import { AvatarObject } from "@/shared/gateway/user/avatar";
import {
  AvatarInvalidKey,
  AvatarNotFound,
  AvatarReader,
  AvatarUnauthorized,
} from "@/shared/gateway/user/avatar/read";
import { DriverFailed } from "@/test/defect";
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
      getAvatarResponse(request).pipe(
        Effect.provide(Layer.succeed(AvatarReader, AvatarReader.of({ read })))
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
  { error: "Unauthorized", failure: new AvatarUnauthorized(), status: 401 },
  { error: "Invalid key", failure: new AvatarInvalidKey(), status: 400 },
  { error: "Not found", failure: new AvatarNotFound(), status: 404 },
] satisfies {
  error: string;
  failure: AvatarInvalidKey | AvatarNotFound | AvatarUnauthorized;
  status: number;
}[];

describe(getAvatarResponse, () => {
  it.effect.each(errorCases)(
    "should answer $status with $error when authorization rejects the request",
    ({ error, failure, status }) =>
      Effect.gen(function* answerTheRejection() {
        const { read, respond } = makeFakes();
        read.mockReturnValue(Effect.fail(failure));

        const response = yield* respond(request());
        const body = yield* Effect.promise(() => response.json());

        expect({ body, status: response.status }).toStrictEqual({
          body: { error },
          status,
        });
      })
  );

  it.effect(
    "should return the object's own response when the authorization boundary returns an avatar",
    () =>
      Effect.gen(function* serveTheObject() {
        const { read, respond } = makeFakes();
        read.mockReturnValue(
          Effect.succeed(new AvatarObject(avatarBody(), "image/webp"))
        );

        const response = yield* respond(request());
        const body = yield* Effect.promise(() => response.text());

        expect({
          body,
          headers: Object.fromEntries(response.headers),
          status: response.status,
        }).toStrictEqual({
          body: "avatar-body",
          headers: {
            "cache-control": "private, max-age=31536000, immutable",
            "content-security-policy": "default-src 'none'",
            "content-type": "image/webp",
            "x-content-type-options": "nosniff",
          },
          status: 200,
        });
      })
  );

  it.effect(
    "should pass the query string's key to the authorization boundary when the request carries one",
    () =>
      Effect.gen(function* passTheQueryKey() {
        const { read, respond } = makeFakes();
        read.mockReturnValue(Effect.fail(new AvatarNotFound()));

        yield* respond(request());

        expect(read.mock.calls).toStrictEqual([
          [Option.some("user-1/avatar.png")],
        ]);
      })
  );

  it.effect(
    "should pass an absent key to the authorization boundary when the request carries no key",
    () =>
      Effect.gen(function* passAnAbsentKey() {
        const { read, respond } = makeFakes();
        read.mockReturnValue(Effect.fail(new AvatarInvalidKey()));

        yield* respond(new Request("https://example.com/api/avatars"));

        expect(read.mock.calls).toStrictEqual([[Option.none()]]);
      })
  );

  it.effect(
    "should propagate the defect when the authorization boundary fails",
    () =>
      Effect.gen(function* propagateTheDefect() {
        const { read, respond } = makeFakes();
        const readFailure = new DriverFailed({ message: "avatar read failed" });
        read.mockReturnValue(Effect.die(readFailure));

        const defect = yield* respond(request()).pipe(
          Effect.catchDefect(Effect.succeed)
        );

        expect(defect).toBe(readFailure);
      })
  );
});
