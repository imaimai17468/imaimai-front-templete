import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  AvatarInvalidKey,
  AvatarNotFound,
  AvatarReader,
  AvatarUnauthorized,
} from "@/server/fn/avatar";
import { getAvatarResponse } from "./avatars";

const makeFakes = () => {
  const read = vi.fn<AvatarReader["Service"]["read"]>();
  return {
    read,
    respond: async (request: Request) =>
      await Effect.runPromise(
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

describe(getAvatarResponse, () => {
  it.each(errorCases)(
    "should return the expected JSON error when authorization rejects the request",
    async (failure, status, error) => {
      const { read, respond } = makeFakes();
      read.mockReturnValue(Effect.fail(failure));

      const response = await respond(request());

      expect({
        status: response.status,
        body: await response.json(),
      }).toStrictEqual({
        status,
        body: { error },
      });
    }
  );

  it.each([
    ["the stored type", "image/webp", "image/webp"],
    ["the fallback type", null, "image/png"],
  ])(
    "should return hardened headers with %s when the avatar exists",
    async (_label, contentType, expectedContentType) => {
      const { read, respond } = makeFakes();
      read.mockReturnValue(Effect.succeed({ body: avatarBody(), contentType }));

      const response = await respond(request());

      expect({
        status: response.status,
        contentType: response.headers.get("Content-Type"),
        cacheControl: response.headers.get("Cache-Control"),
        noSniff: response.headers.get("X-Content-Type-Options"),
        contentSecurityPolicy: response.headers.get("Content-Security-Policy"),
        body: await response.text(),
      }).toStrictEqual({
        status: 200,
        contentType: expectedContentType,
        cacheControl: "private, max-age=31536000, immutable",
        noSniff: "nosniff",
        contentSecurityPolicy: "default-src 'none'",
        body: "avatar-body",
      });
    }
  );

  it("should pass the query string's key to the authorization boundary when the request carries one", async () => {
    const { read, respond } = makeFakes();
    read.mockReturnValue(Effect.fail(new AvatarNotFound()));

    await respond(request());

    expect(read.mock.calls).toStrictEqual([["user-1/avatar.png"]]);
  });

  it("should propagate the defect when the authorization boundary fails", async () => {
    const { read, respond } = makeFakes();
    read.mockReturnValue(Effect.die(new Error("avatar read failed")));

    const result = respond(request());

    await expect(result).rejects.toThrow("avatar read failed");
  });
});
