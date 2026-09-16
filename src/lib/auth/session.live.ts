import { getRequest } from "@tanstack/react-start/server";
import { getAuth } from "./auth.live";
import { pickUser } from "./session-user";

export const getSession = () =>
  getAuth().api.getSession({ headers: getRequest().headers });

/**
 * セッションから User を取り出すヘルパー。テンプレ用途で公開、派生実装で使う想定。
 *
 * @public
 */
export const getUser = () => getSession().then(pickUser);
