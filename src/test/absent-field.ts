import { Option } from "effect";

/**
 * The encoded spelling of an absent field, for a fixture whose subject is a
 * schema's encoded side.
 *
 * `effect/noNullish` reports a written `null`, and an encoded field stays
 * nullable so the value survives JSON, so the two demands meet here.
 */
export const ABSENT_FIELD = Option.getOrNull(Option.none<string>());
