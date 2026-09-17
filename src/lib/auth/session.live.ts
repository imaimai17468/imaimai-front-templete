import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { Option } from "effect";
import { getAuth } from "./auth.live";
import { pickUser } from "./session-user";

const getSession = () =>
  getAuth().api.getSession({ headers: getRequest().headers });

export const getUser = () =>
  getSession().then((session) => pickUser(Option.fromNullishOr(session)));
