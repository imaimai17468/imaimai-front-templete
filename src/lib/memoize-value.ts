import { Option } from "effect";

/**
 * Runs `build` on the first call of the returned reader and returns that value
 * from every later call. A `build` that throws writes nothing, so the next call
 * runs it again.
 */
export const memoizeValue = <T>(build: () => T): (() => T) => {
  let cached = Option.none<T>();

  return () =>
    Option.getOrElse(cached, () => {
      const fresh = build();
      cached = Option.some(fresh);
      return fresh;
    });
};
