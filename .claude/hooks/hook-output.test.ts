/**
 * Exercise readHookJson's two branches directly.
 *
 * `coverage.include` in vitest.config.mts covers `src/**`, `tools/**` and
 * `scripts/**`, so no per-file branch threshold reaches this directory and
 * a branch here is pinned by a case rather than by a number.
 */

import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { readHookJson } from "./hook-output";

const Decision = z.object({
  decision: z.string().default(""),
  reason: z.string().default(""),
});

describe("hook-output", () => {
  it("should fall back to the schema's defaults when the hook printed nothing", () => {
    const stdout = "   \n";

    const parsed = readHookJson(stdout, Decision);

    expect(parsed).toStrictEqual({ decision: "", reason: "" });
  });

  it("should return the fields the hook printed when its stdout is JSON", () => {
    const stdout = '{"decision":"block","reason":"named a protected file"}\n';

    const parsed = readHookJson(stdout, Decision);

    expect(parsed).toStrictEqual({
      decision: "block",
      reason: "named a protected file",
    });
  });

  it("should throw when the hook printed something that is not JSON", () => {
    const stdout = "pre-bash-guard.sh: line 14: jq: command not found\n";

    expect(() => readHookJson(stdout, Decision)).toThrow(SyntaxError);
  });

  it("should throw when the hook printed JSON the schema rejects", () => {
    const stdout = '{"decision":7}';

    expect(() => readHookJson(stdout, Decision)).toThrow(z.ZodError);
  });
});
