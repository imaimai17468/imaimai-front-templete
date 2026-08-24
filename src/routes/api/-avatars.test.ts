import { describe, expect, it, vi } from "vitest";
import type { AvatarReadResult } from "@/server/fn/avatar";
import { createGetAvatarResponse } from "./avatars";
import type { AvatarReader } from "./avatars";

const makeFakes = () => {
  const readAvatar = vi.fn<AvatarReader>();
  return { getAvatarResponse: createGetAvatarResponse(readAvatar), readAvatar };
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
  [{ kind: "unauthorized" }, 401, "Unauthorized"],
  [{ kind: "invalid-key" }, 400, "Invalid key"],
  [{ kind: "not-found" }, 404, "Not found"],
] satisfies [AvatarReadResult, number, string][];

describe("getAvatarResponse", () => {
  it.each(errorCases)(
    "should return the expected JSON error when authorization rejects the request",
    async (result, status, error) => {
      const { getAvatarResponse, readAvatar } = makeFakes();
      readAvatar.mockResolvedValue(result);

      const response = await getAvatarResponse(request());

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
      const { getAvatarResponse, readAvatar } = makeFakes();
      readAvatar.mockResolvedValue({
        kind: "found",
        avatar: {
          body: avatarBody(),
          contentType,
        },
      });

      const response = await getAvatarResponse(request());

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

  it("should propagate the error when the authorization boundary fails", async () => {
    const { getAvatarResponse, readAvatar } = makeFakes();
    readAvatar.mockRejectedValue(new Error("avatar read failed"));

    const result = getAvatarResponse(request());

    await expect(result).rejects.toThrow("avatar read failed");
  });
});
