import { getRequest } from "@tanstack/react-start/server";
import { getAuth } from "./auth";

export const getSession = async () => {
  return await getAuth().api.getSession({ headers: getRequest().headers });
};

/** @public セッションから User を取り出すヘルパー。テンプレ用途で公開、派生実装で使う想定。 */
export const getUser = async () => {
  const session = await getSession();
  return session?.user ?? null;
};
