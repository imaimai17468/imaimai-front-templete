import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/** @public Better Auth の公開 API。テンプレ用途で export を維持（派生プロジェクトで認証 UI 実装時に使う）。 */
export const { signIn, signOut, useSession } = authClient;
