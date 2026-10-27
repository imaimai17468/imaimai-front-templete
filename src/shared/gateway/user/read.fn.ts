import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "./read";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  getCurrentUser
);

export const currentUserQueryOptions = () =>
  queryOptions({
    queryFn: ({ signal }) => getCurrentUserFn({ signal }),
    queryKey: ["user", "current"],
  });
