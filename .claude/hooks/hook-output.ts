import type { ZodType } from "zod";

/**
 * A hook's JSON stdout, validated against the shape its caller expects.
 *
 * Empty stdout is read as an empty object, so the schema's own defaults answer
 * for every field. Whether that silence came from a hook that decided nothing
 * or from one that died is not visible here, and the caller settles it: the
 * pre-bash-guard cases assert the hook's exit status alongside its decision.
 * Text that is not JSON throws rather than reading as silence.
 */
export const readHookJson = <T>(stdout: string, schema: ZodType<T>): T => {
  const trimmed = stdout.trim();
  const emitted: unknown = trimmed === "" ? {} : JSON.parse(trimmed);
  return schema.parse(emitted);
};
