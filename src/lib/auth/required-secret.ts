import { Option, Schema } from "effect";

export type AuthSecretName =
  | "BETTER_AUTH_SECRET"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET";

const configuredSecret = (name: AuthSecretName) => {
  // The same text on both: the annotation answers an absent secret, which
  // reaches the schema as a non-string, and the check answers an empty one.
  const missing = {
    message: `${name} is not set. Register it with \`wrangler secret put ${name}\` for a deployed Worker, or set it in .env.local for local development.`,
  };
  return Schema.String.annotate(missing).check(Schema.isMinLength(1, missing));
};

export const requireAuthSecret = (
  name: AuthSecretName,
  value: Option.Option<string>
): string =>
  Schema.decodeUnknownSync(configuredSecret(name))(
    Option.getOrUndefined(value)
  );
