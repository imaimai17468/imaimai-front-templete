"use server";

import { redirect } from "next/navigation";

/** @public テンプレ用途のサインアウト server action。派生プロジェクトで使う想定で維持。 */
export const signOut = async () => {
  redirect("/");
};
