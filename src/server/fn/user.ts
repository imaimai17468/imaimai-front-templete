import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { fetchCurrentUser } from "@/gateways/user";
import { getSession } from "@/lib/auth/session";

export const getCurrentUser = createServerOnlyFn(async () => {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }
  return fetchCurrentUser(session.user.id, session.user.email);
});

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  getCurrentUser
);
