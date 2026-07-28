import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/lib/drizzle/db";
import * as schema from "@/lib/drizzle/schema";
import { getCloudflareEnv } from "@/server/cloudflare";

const buildAuth = () => {
  const env = getCloudflareEnv();
  // better-auth resolves BETTER_AUTH_SECRET from `globalThis.process.env`,
  // which workerd populates from text bindings only while
  // `nodejs_compat_populate_process_env` is on — default for
  // compatibility_date >= 2025-04-01
  // (https://developers.cloudflare.com/workers/configuration/environment-variables/).
  // The secret is still handed over explicitly, because explicit wiring does
  // not depend on that runtime flag staying default (ADR-0018).
  // The absence has to be fatal here: better-auth's own guard against its
  // public default secret only fires when it believes it is in production, and
  // it decides that from NODE_ENV — which is not a Worker binding, so it is
  // absent from the populated `process.env` and the guard is false in every
  // environment. Without this throw, a missing secret silently signs sessions
  // with a published constant.
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Register it with `wrangler secret put BETTER_AUTH_SECRET` for a deployed Worker, or set it in .env.local for local development."
    );
  }

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
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
