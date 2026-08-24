import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { userGateway } from "@/gateways/user";
import type { UserWithEmail } from "@/entities/user";
import { getSession } from "@/lib/auth/session";

/**
 * The identity source and the profile read this server function needs.
 *
 * Injected so a test drives the authorization path without a session cookie or
 * a D1 binding.
 */
export interface CurrentUserDeps {
  readSession: () => Promise<Awaited<ReturnType<typeof getSession>>>;
  fetchCurrentUser: (
    userId: string,
    email: string
  ) => Promise<UserWithEmail | null>;
}

export const createGetCurrentUser = ({
  fetchCurrentUser,
  readSession,
}: CurrentUserDeps) => {
  const readCurrentUser = async (): Promise<UserWithEmail | null> => {
    const session = await readSession();
    if (!session?.user) {
      return null;
    }
    return await fetchCurrentUser(session.user.id, session.user.email);
  };
  return readCurrentUser;
};

export const getCurrentUser = createServerOnlyFn(
  createGetCurrentUser({
    fetchCurrentUser: async (userId, email) =>
      await userGateway.fetchCurrentUser(userId, email),
    readSession: getSession,
  })
);

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  getCurrentUser
);
