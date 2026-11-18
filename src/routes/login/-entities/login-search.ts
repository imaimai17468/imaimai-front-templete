import { Schema } from "effect";

/**
 * The query `/login` reads. Better Auth sends a failed Google sign-in back to
 * the `errorCallbackURL` with the failure's code in `error`.
 */
export const LoginSearchSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ error: Schema.optionalKey(Schema.String) })
);
