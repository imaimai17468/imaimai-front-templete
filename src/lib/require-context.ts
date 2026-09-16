import { Option, Schema } from "effect";

/** A component read a context whose provider was not above it. */
class ContextMissing extends Schema.TaggedError<ContextMissing>()(
  "ContextMissing",
  { message: Schema.String }
) {}

/**
 * Unwraps a mandatory context value, throwing `ContextMissing` under the given
 * message when the `Option` is `None`.
 *
 * A React context's provider is mandatory by convention rather than by type, so
 * its absence survives to runtime.
 */
export const requireContext = <T>(
  value: Option.Option<T>,
  message: string
): T => Option.getOrThrowWith(value, () => new ContextMissing({ message }));
