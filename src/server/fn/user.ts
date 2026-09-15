import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { runCurrentUser } from "./current-user";

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  createServerOnlyFn(runCurrentUser)
);
