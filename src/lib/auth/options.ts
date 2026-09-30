import "@tanstack/react-start/server-only";
import type { BetterAuthOptions, DBAdapterInstance } from "better-auth";

export interface AuthSecrets {
  readonly authSecret: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
}

export interface AuthOptionsInput {
  readonly database: DBAdapterInstance;
  readonly isDevBuild: boolean;
  readonly secrets: AuthSecrets;
}

/**
 * Every option here that better-auth would otherwise infer from NODE_ENV is
 * pinned, because NODE_ENV is not a Worker binding: it is absent from the
 * `process.env` a deployed Worker populates, so better-auth's production
 * defaults never switch on there.
 */
export const authOptions = ({
  database,
  isDevBuild,
  secrets,
}: AuthOptionsInput) =>
  ({
    advanced: {
      // better-auth falls back to NODE_ENV to decide the session cookie's
      // Secure flag when neither this option nor `baseURL` is set. The dev arm
      // stays false because `bun run dev` serves plain http through portless.
      useSecureCookies: !isDevBuild,
    },
    database,
    // 本番ビルドでは Vite が `import.meta.env.DEV` を false に畳むので、
    // /api/auth/sign-in/email は EMAIL_PASSWORD_DISABLED を、
    // /api/auth/sign-up/email は EMAIL_PASSWORD_SIGN_UP_DISABLED を返す。
    emailAndPassword: { autoSignIn: true, enabled: isDevBuild },
    secret: secrets.authSecret,
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    socialProviders: {
      google: {
        clientId: secrets.googleClientId,
        clientSecret: secrets.googleClientSecret,
      },
    },
  }) satisfies BetterAuthOptions;
