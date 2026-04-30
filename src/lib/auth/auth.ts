import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/lib/drizzle/db";
import * as schema from "@/lib/drizzle/schema";
import { getCloudflareEnv } from "@/server/cloudflare";

const buildAuth = () => {
  const env = getCloudflareEnv() as unknown as Record<string, string>;
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
};

let cachedAuth: ReturnType<typeof buildAuth> | null = null;

export const getAuth = (): ReturnType<typeof buildAuth> => {
  if (cachedAuth) return cachedAuth;
  const fresh = buildAuth();
  cachedAuth = fresh;
  return fresh;
};

/** @public Better Auth の Session 型。テンプレ用途で公開、派生実装で使う想定。 */
export type Session = ReturnType<typeof buildAuth>["$Infer"]["Session"];
