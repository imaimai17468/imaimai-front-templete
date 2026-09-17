import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Option } from "effect";
import { getCurrentUser } from "./read";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
  getCurrentUser
);

export const currentUserQueryOptions = () =>
  queryOptions({
    queryFn: ({ signal }) => getCurrentUserFn({ signal }),
    queryKey: ["user", "current"],
    // Runs per read and leaves `state.data` the nullable row the server sent,
    // so the dehydrated cache still carries what `createServerFn` serialized.
    select: Option.fromNullOr,
  });
