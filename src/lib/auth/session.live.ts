import { getRequest } from "@tanstack/react-start/server";
import { Option } from "effect";
import { getAuth } from "./auth.live";
import { pickUser } from "./session-user";

export const getSession = () =>
  getAuth().api.getSession({ headers: getRequest().headers });

/**
 * ログイン中の User を返すヘルパー。セッションが無いときは Option.none を返す。
 * テンプレ用途で公開、派生実装で使う想定。
 *
 * @public
 */
export const getUser = () =>
  getSession().then((session) => pickUser(Option.fromNullishOr(session)));
