import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "./read";

export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  getCurrentUser
);
