import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { UserWithEmail } from "@/shared/entities/user";
import { currentUserQueryOptions } from "@/shared/gateway/user/read.fn";
import { ABSENT_FIELD } from "@/test/absent-field";
import { renderWithRouter } from "@/test/router-utils";
import { ProfileGate } from "./profile-gate";

const signedIn: UserWithEmail = {
  avatarUrl: ABSENT_FIELD,
  createdAt: "2024-01-02T03:04:05.000Z",
  email: "reader@example.com",
  id: "user-1",
  name: "Reader",
  updatedAt: "2024-01-02T03:04:05.000Z",
};

const seed = (queryClient: QueryClient, user: Option.Option<UserWithEmail>) => {
  queryClient.setQueryData(
    currentUserQueryOptions().queryKey,
    Option.getOrNull(user)
  );
};

/** The query's `select` builds the `Option` the gate matches on, so the cache
 * holds the nullable form and the tests name the arm they want in `Option`. */
const gateReading = (user: Option.Option<UserWithEmail>) => {
  const queryClient = new QueryClient();
  seed(queryClient, user);
  return {
    queryClient,
    ui: (
      <QueryClientProvider client={queryClient}>
        <ProfileGate />
      </QueryClientProvider>
    ),
  };
};

describe(ProfileGate, () => {
  it("should navigate to the login page when the read returns no user", () => {
    const { ui } = gateReading(Option.none());

    const rendered = renderWithRouter(ui);

    return rendered.then(({ router }) =>
      waitFor(() => {
        expect(router.state.location.pathname).toBe("/login");
      })
    );
  });

  it("should show the user's email when the read returns a signed-in user", () => {
    const { ui } = gateReading(Option.some(signedIn));

    const email = renderWithRouter(ui).then(({ findByText }) =>
      findByText(signedIn.email)
    );

    return expect(email).resolves.toBeInTheDocument();
  });

  it("should navigate to the login page when the read stops returning a user under a mounted page", () => {
    const { queryClient, ui } = gateReading(Option.some(signedIn));

    const signedOut = renderWithRouter(ui).then(({ router }) => {
      act(() => {
        seed(queryClient, Option.none());
      });
      return router;
    });

    return signedOut.then((router) =>
      waitFor(() => {
        expect(router.state.location.pathname).toBe("/login");
      })
    );
  });
});
