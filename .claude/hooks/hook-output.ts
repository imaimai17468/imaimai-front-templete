import type { ZodType } from "zod";

/**
 * A hook's JSON stdout, validated against the shape its caller expects.
 *
 * A hook that decides nothing prints nothing, so silence is read as an empty
 * object and the schema's own defaults answer for the absent fields. That keeps
 * a silent hook and a malformed one apart: the second still throws.
 */
export const readHookJson = <T>(stdout: string, schema: ZodType<T>): T => {
  const trimmed = stdout.trim();
  const emitted: unknown = trimmed === "" ? {} : JSON.parse(trimmed);
  return schema.parse(emitted);
};
