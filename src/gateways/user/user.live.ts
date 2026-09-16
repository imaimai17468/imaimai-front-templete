import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { runCurrentUser } from "./current-user";

const getCurrentUser = createServerOnlyFn(runCurrentUser);

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  getCurrentUser
);
