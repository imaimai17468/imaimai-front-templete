import { describe, expect, it } from "vite-plus/test";
import { currentUserQueryOptions } from "./read.fn.ts";

describe(currentUserQueryOptions, () => {
  it("should key the read as the user directory and its operation when a write invalidates the user directory by prefix", () => {
    expect(currentUserQueryOptions().queryKey).toStrictEqual([
      "user",
      "current",
    ]);
  });
});
