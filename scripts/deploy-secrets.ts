/**
 * Which secrets a deploy is about to bind with a development value.
 */

export const DEPLOY_SECRET_NAMES = [
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] satisfies readonly string[];

/**
 * The names whose value in `env` equals the one the development env file
 * gives them. `bun run` loads that file into every script it starts, so a
 * secret the shell did not export arrives with the development value, and a
 * production value never equals it.
 */
export const secretsFromDevFile = (
  env: Readonly<Record<string, string | undefined>>,
  devFile: Readonly<Record<string, string>>
): readonly string[] =>
  DEPLOY_SECRET_NAMES.filter(
    (name) => env[name] !== undefined && env[name] === devFile[name]
  );
