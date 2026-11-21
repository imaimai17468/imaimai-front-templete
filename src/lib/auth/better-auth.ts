import "@tanstack/react-start/server-only";
import * as schema from "@schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "void/db";
import { env } from "void/env";
import { memoizeValue } from "@/lib/memoize-value";
import { authOptions } from "./options.ts";

const buildAuth = () =>
  betterAuth(
    authOptions({
      database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
          account: schema.accounts,
          rateLimit: schema.rateLimits,
          session: schema.sessions,
          user: schema.users,
          verification: schema.verifications,
        },
      }),
      isDevBuild: import.meta.env.DEV,
      // better-auth resolves BETTER_AUTH_SECRET from `globalThis.process.env`,
      // which workerd populates from text bindings only while
      // `nodejs_compat_populate_process_env` is on — default for
      // compatibility_date >= 2025-04-01
      // (https://developers.cloudflare.com/workers/configuration/environment-variables/).
      // The secret is still handed over explicitly, because explicit wiring
      // does not depend on that runtime flag staying default.
      // The absence has to be fatal here: better-auth's own guard against its
      // public default secret only fires when it believes it is in
      // production, and it decides that from NODE_ENV, so the guard is false
      // in every environment. Reading `env` throws an EnvValidationError
      // naming a key that env.ts requires and the Worker lacks or holds empty,
      // so a missing secret never signs sessions with a published constant.
      secrets: {
        authSecret: env.BETTER_AUTH_SECRET,
        googleClientId: env.GOOGLE_CLIENT_ID,
        googleClientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    })
  );

export const getAuth = memoizeValue(buildAuth);

/**
 * Better Auth の Session 型。テンプレ用途で公開、派生実装で使う想定。
 *
 * @public
 */
export type Session = ReturnType<typeof buildAuth>["$Infer"]["Session"];
