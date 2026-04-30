import { createServerFn } from "@tanstack/react-start";
import { fetchCurrentUser } from "@/gateways/user";

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return await fetchCurrentUser();
  }
);
