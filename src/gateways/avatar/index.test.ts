import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAvatar } from ".";

const { bucketGet } = vi.hoisted(() => ({
  bucketGet: vi.fn<(key: string) => Promise<unknown>>(),
}));

vi.mock("@/server/cloudflare", () => ({
  getCloudflareEnv: () => ({
    AVATARS_BUCKET: {
      get: bucketGet,
    },
  }),
}));

describe("fetchAvatar", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return null when R2 has no object", async () => {
    bucketGet.mockResolvedValue(null);

    const result = await fetchAvatar("user-1/avatar.png");

    expect({
      result,
      calls: bucketGet.mock.calls,
    }).toEqual({
      result: null,
      calls: [["user-1/avatar.png"]],
    });
  });

  it("should return the body and stored content type when R2 has metadata", async () => {
    const body = new ReadableStream<Uint8Array>();
    bucketGet.mockResolvedValue({
      body,
      httpMetadata: { contentType: "image/webp" },
    });

    const result = await fetchAvatar("user-1/avatar.webp");

    expect(result).toEqual({
      body,
      contentType: "image/webp",
    });
  });

  it("should return a null content type when R2 has no metadata", async () => {
    const body = new ReadableStream<Uint8Array>();
    bucketGet.mockResolvedValue({ body });

    const result = await fetchAvatar("user-1/avatar.png");

    expect(result).toEqual({
      body,
      contentType: null,
    });
  });

  it("should propagate the error when R2 fails", async () => {
    bucketGet.mockRejectedValue(new Error("R2 failed"));

    const result = fetchAvatar("user-1/avatar.png");

    await expect(result).rejects.toThrow("R2 failed");
  });
});
