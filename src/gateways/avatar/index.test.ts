import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { AvatarBucket, AvatarGateway } from ".";

const makeFakes = () => {
  const get = vi.fn<AvatarBucket["Service"]["get"]>();
  const layer = AvatarGateway.layerNoDeps.pipe(
    Layer.provide(Layer.succeed(AvatarBucket, AvatarBucket.of({ get })))
  );
  return {
    fetchAvatar: (key: string) =>
      Effect.runPromise(
        Effect.gen(function* callFetchAvatar() {
          const gateway = yield* AvatarGateway;
          return yield* gateway.fetchAvatar(key);
        }).pipe(Effect.provide(layer))
      ),
    get,
  };
};

describe("fetchAvatar", () => {
  it("should return null when R2 has no object", () => {
    const { fetchAvatar, get } = makeFakes();
    get.mockReturnValue(Effect.succeed(null));

    return fetchAvatar("user-1/avatar.png").then((result) => {
      expect({ calls: get.mock.calls, result }).toStrictEqual({
        calls: [["user-1/avatar.png"]],
        result: null,
      });
    });
  });

  it("should return the body and stored content type when R2 has metadata", () => {
    const { fetchAvatar, get } = makeFakes();
    const body = new ReadableStream<Uint8Array>();
    get.mockReturnValue(
      Effect.succeed({ body, httpMetadata: { contentType: "image/webp" } })
    );

    return fetchAvatar("user-1/avatar.webp").then((result) => {
      expect(result).toStrictEqual({ body, contentType: "image/webp" });
    });
  });

  it("should return a null content type when R2 has no metadata", () => {
    const { fetchAvatar, get } = makeFakes();
    const body = new ReadableStream<Uint8Array>();
    get.mockReturnValue(Effect.succeed({ body }));

    return fetchAvatar("user-1/avatar.png").then((result) => {
      expect(result).toStrictEqual({ body, contentType: null });
    });
  });

  it("should propagate the defect when R2 fails", () => {
    const { fetchAvatar, get } = makeFakes();
    get.mockReturnValue(Effect.die(new Error("R2 failed")));

    const result = fetchAvatar("user-1/avatar.png");

    return expect(result).rejects.toThrow("R2 failed");
  });
});
