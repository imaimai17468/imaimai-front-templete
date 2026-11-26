import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { serverFnQuery } from "@/lib/query/server-fn-query";
import { getCurrentUser } from "./read.ts";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  getCurrentUser
);

export const currentUserQueryOptions = () =>
  queryOptions({
    queryFn: serverFnQuery(getCurrentUserFn),
    queryKey: ["user", "current"],
  });
