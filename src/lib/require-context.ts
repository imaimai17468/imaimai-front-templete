import { Option, Schema } from "effect";

/** A component read a context whose provider was not above it. */
class ContextMissing extends Schema.TaggedError<ContextMissing>()(
  "ContextMissing",
  { message: Schema.String }
) {}

/**
 * Returns a mandatory context value as `React.useContext` handed it over,
 * throwing `ContextMissing` under the given message when it is `null` or
 * `undefined`.
 *
 * A React context's provider is mandatory by convention rather than by type, so
 * its absence survives to runtime.
 */
export const requireContext = <T>(value: T, message: string): NonNullable<T> =>
  Option.getOrThrowWith(
    Option.fromNullishOr(value),
    () => new ContextMissing({ message })
  );
