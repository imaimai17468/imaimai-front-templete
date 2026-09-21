import { describe, expect, it } from "vite-plus/test";
import { cn } from "./utils";

const withOptionalClassName = ({
  className,
}: {
  readonly className?: string;
}) => cn("underline", className);

describe(cn, () => {
  it("should join classes when inputs are independent", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("should keep only the last utility when Tailwind classes conflict", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("should drop falsy values when inputs come from conditional expressions", () => {
    expect(cn("underline", false, "")).toBe("underline");
  });

  it("should keep the base class when the caller omits the optional one", () => {
    expect(withOptionalClassName({})).toBe("underline");
  });

  it("should flatten nested inputs when arrays and objects are mixed", () => {
    expect(cn(["contents", { italic: true, overline: false }])).toBe(
      "contents italic"
    );
  });
});
