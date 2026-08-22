import { RPCHandler } from "@orpc/server/fetch";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { fetchCurrentUser, updateUser } from "@/gateways/user";
import { getSession } from "@/lib/auth/session";
import { router } from "./index";

vi.mock("@/gateways/user", () => ({
  fetchCurrentUser: vi.fn<typeof fetchCurrentUser>(),
  updateUser: vi.fn<typeof updateUser>(),
  updateUserAvatar: vi.fn<() => never>(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn<typeof getSession>(),
}));

const handler = new RPCHandler(router);

const post = async (path: string, body: unknown) => {
  const { response } = await handler.handle(
    new Request(`https://example.com/api/rpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: body }),
    }),
    { prefix: "/api/rpc", context: {} }
  );
  return response;
};

// The migration off createServerFn kept "not authenticated" as an ordinary
// return value rather than promoting it to a 401. specs/server-boundary.spec.md
// names that as the caller-visible parity question; this pins the answer.
describe("HTTP parity of the anonymous result", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("should answer 200 rather than 401 when the caller is anonymous", async () => {
    const response = await post("profile/update", { name: "Ada" });

    expect(response?.status).toBe(200);
  });

  it("should carry the error as an ordinary payload when the caller is anonymous", async () => {
    const response = await post("profile/update", { name: "Ada" });

    expect(await response?.json()).toEqual({
      json: { error: "Not authenticated" },
    });
  });
});
