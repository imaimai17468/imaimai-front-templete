export type AuthSecretName =
  | "BETTER_AUTH_SECRET"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET";

export const requireAuthSecret = (
  name: AuthSecretName,
  value: string | undefined
): string => {
  if (value !== undefined && value.length > 0) {
    return value;
  }
  throw new Error(
    `${name} is not set. Register it with \`wrangler secret put ${name}\` for a deployed Worker, or set it in .env.local for local development.`
  );
};
