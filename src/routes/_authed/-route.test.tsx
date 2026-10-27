import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";
import { routeTree } from "@/routeTree.gen";
import type { UserWithEmail } from "@/shared/entities/user";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";

// The root route loads the dev overlay in a dev browser build, which this test
// environment is, and the overlay asks jsdom for a `matchMedia` it lacks.
vi.mock("react-grab", () => ({}));

const signedIn: UserWithEmail = {
  avatarUrl: null,
  createdAt: "2024-01-02T03:04:05.000Z",
  email: "reader@example.com",
  id: "user-1",
  name: "Reader",
  updatedAt: "2024-01-02T03:04:05.000Z",
};

const loadProfileReading = (user: UserWithEmail | null) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(currentUserQueryOptions().queryKey, user);
  const router = createRouter({
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/profile"] }),
    routeTree,
  });
  return router.load().then(() => router.state.location.pathname);
};

describe("the signed-in area's guard", () => {
  it("should land on the login page when the read returns no user", () =>
    expect(loadProfileReading(null)).resolves.toBe("/login"));

  it("should stay on the profile page when the read returns a signed-in user", () =>
    expect(loadProfileReading(signedIn)).resolves.toBe("/profile"));
});
