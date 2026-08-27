import { describe, expect, it, vi } from "vite-plus/test";
import { createAvatarGateway } from ".";
import type { AvatarBucket } from ".";

const makeFakes = () => {
  const get = vi.fn<AvatarBucket["get"]>();
  return { gateway: createAvatarGateway({ bucket: { get } }), get };
};

describe("fetchAvatar", () => {
  it("should return null when R2 has no object", async () => {
    const { gateway, get } = makeFakes();
    get.mockResolvedValue(null);

    const result = await gateway.fetchAvatar("user-1/avatar.png");

    expect({ calls: get.mock.calls, result }).toStrictEqual({
      calls: [["user-1/avatar.png"]],
      result: null,
    });
  });

  it("should return the body and stored content type when R2 has metadata", async () => {
    const { gateway, get } = makeFakes();
    const body = new ReadableStream<Uint8Array>();
    get.mockResolvedValue({
      body,
      httpMetadata: { contentType: "image/webp" },
    });

    const result = await gateway.fetchAvatar("user-1/avatar.webp");

    expect(result).toStrictEqual({ body, contentType: "image/webp" });
  });

  it("should return a null content type when R2 has no metadata", async () => {
    const { gateway, get } = makeFakes();
    const body = new ReadableStream<Uint8Array>();
    get.mockResolvedValue({ body });

    const result = await gateway.fetchAvatar("user-1/avatar.png");

    expect(result).toStrictEqual({ body, contentType: null });
  });

  it("should propagate the error when R2 fails", async () => {
    const { gateway, get } = makeFakes();
    get.mockRejectedValue(new Error("R2 failed"));

    const result = gateway.fetchAvatar("user-1/avatar.png");

    await expect(result).rejects.toThrow("R2 failed");
  });
});
