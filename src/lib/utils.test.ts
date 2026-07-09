import { describe, expect, it } from "vitest";
import { cn } from "./utils";

// Exemplar test (AGENTS.md "Testing"): colocated `<module>.test.ts`, white-box —
// each case pins one behavior of the implementation (clsx flattening on one
// side, twMerge conflict resolution on the other), not just happy-path output.
describe("cn", () => {
  it("should join classes when inputs are independent", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("should keep only the last utility when Tailwind classes conflict", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("should drop falsy values when inputs come from conditional expressions", () => {
    expect(cn("base", false, undefined, "")).toBe("base");
  });

  it("should flatten nested inputs when arrays and objects are mixed", () => {
    expect(cn(["a", { b: true, c: false }])).toBe("a b");
  });
});
