import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Validates `input` through the schema's Standard Schema view, the way
 * react-hook-form's resolver and a server function's validator read it.
 *
 * The contract lets `validate` answer with the result or with a Promise of it,
 * and this resolves both arms.
 */
export const validateStandard = <Schema extends StandardSchemaV1>(
  schema: Schema,
  input: Parameters<Schema["~standard"]["validate"]>[0]
): Promise<StandardSchemaV1.Result<StandardSchemaV1.InferOutput<Schema>>> =>
  globalThis.Promise.resolve(schema["~standard"].validate(input));
