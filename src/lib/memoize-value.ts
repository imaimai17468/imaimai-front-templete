import { Option } from "effect";

/**
 * Runs `build` on the first call of the returned reader and returns that value
 * from every later call. A `build` that throws writes nothing, so the next call
 * runs it again.
 */
export const memoizeValue = <T>(build: () => T): (() => T) => {
  const cache = { value: Option.none<T>() };

  return () =>
    Option.getOrElse(cache.value, () => {
      const fresh = build();
      cache.value = Option.some(fresh);
      return fresh;
    });
};
