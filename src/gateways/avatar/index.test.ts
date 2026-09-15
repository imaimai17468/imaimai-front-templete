import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { AvatarBucket, AvatarGateway } from ".";

const makeFakes = () => {
  const get = vi.fn<AvatarBucket["Service"]["get"]>();
  const layer = AvatarGateway.layerNoDeps.pipe(
    Layer.provide(Layer.succeed(AvatarBucket, AvatarBucket.of({ get })))
  );
  return {
    fetchAvatar: async (key: string) =>
      await Effect.runPromise(
        Effect.gen(function* callFetchAvatar() {
          const gateway = yield* AvatarGateway;
          return yield* gateway.fetchAvatar(key);
        }).pipe(Effect.provide(layer))
      ),
    get,
  };
};

describe("fetchAvatar", () => {
  it("should return null when R2 has no object", async () => {
    const { fetchAvatar, get } = makeFakes();
    get.mockReturnValue(Effect.succeed(null));

    const result = await fetchAvatar("user-1/avatar.png");

    expect({ calls: get.mock.calls, result }).toStrictEqual({
      calls: [["user-1/avatar.png"]],
      result: null,
    });
  });

  it("should return the body and stored content type when R2 has metadata", async () => {
    const { fetchAvatar, get } = makeFakes();
    const body = new ReadableStream<Uint8Array>();
    get.mockReturnValue(
      Effect.succeed({ body, httpMetadata: { contentType: "image/webp" } })
    );

    const result = await fetchAvatar("user-1/avatar.webp");

    expect(result).toStrictEqual({ body, contentType: "image/webp" });
  });

  it("should return a null content type when R2 has no metadata", async () => {
    const { fetchAvatar, get } = makeFakes();
    const body = new ReadableStream<Uint8Array>();
    get.mockReturnValue(Effect.succeed({ body }));

    const result = await fetchAvatar("user-1/avatar.png");

    expect(result).toStrictEqual({ body, contentType: null });
  });

  it("should propagate the defect when R2 fails", async () => {
    const { fetchAvatar, get } = makeFakes();
    get.mockReturnValue(Effect.die(new Error("R2 failed")));

    const result = fetchAvatar("user-1/avatar.png");

    await expect(result).rejects.toThrow("R2 failed");
  });
});
