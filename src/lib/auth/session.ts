import { headers } from "next/headers";
import { auth } from "./auth";

export const getSession = async () => {
  return await auth.api.getSession({ headers: await headers() });
};

/** @public セッションから User を取り出すヘルパー。テンプレ用途で公開、派生実装で使う想定。 */
export const getUser = async () => {
  const session = await getSession();
  return session?.user ?? null;
};
