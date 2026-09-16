import { Option, Schema } from "effect";

/** A component read a context whose provider was not above it. */
class ContextMissing extends Schema.TaggedError<ContextMissing>()(
  "ContextMissing",
  { message: Schema.String }
) {}

/**
 * Reads a React context whose provider is mandatory.
 *
 * The type system cannot express "this hook is only called inside that
 * provider", so a component rendered outside it reaches this with `null`. The
 * failure is raised by `Option` rather than by a bare `throw`, which keeps the
 * caller's own control flow free of one.
 */
export const requireContext = <T>(value: T | null, message: string): T =>
  Option.getOrThrowWith(
    Option.fromNullOr(value),
    () => new ContextMissing({ message })
  );
