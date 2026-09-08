import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Separator } from "./separator";

describe(Separator, () => {
  it("should render a decorative horizontal rule when orientation and decorative are omitted", () => {
    render(<Separator data-testid="separator" />);

    const separator = screen.getByTestId("separator");

    expect({
      slot: separator.dataset.slot,
      orientation: separator.dataset.orientation,
      role: separator.getAttribute("role"),
    }).toStrictEqual({
      slot: "separator",
      orientation: "horizontal",
      role: "none",
    });
  });

  it("should expose the separator role when decorative is false", () => {
    render(<Separator data-testid="separator" decorative={false} />);

    const separator = screen.getByTestId("separator");

    expect({
      role: separator.getAttribute("role"),
      ariaOrientation: separator.getAttribute("aria-orientation"),
    }).toStrictEqual({ role: "separator", ariaOrientation: null });
  });

  it("should announce a vertical orientation when orientation is vertical", () => {
    render(
      <Separator
        data-testid="separator"
        decorative={false}
        orientation="vertical"
      />
    );

    const separator = screen.getByTestId("separator");

    expect({
      orientation: separator.dataset.orientation,
      ariaOrientation: separator.getAttribute("aria-orientation"),
    }).toStrictEqual({ orientation: "vertical", ariaOrientation: "vertical" });
  });

  it("should drop only the conflicting base class when className overrides one of them", () => {
    render(<Separator className="bg-transparent" data-testid="separator" />);

    const separator = screen.getByTestId("separator");

    expect({
      hasCaller: separator.classList.contains("bg-transparent"),
      hasConflictingBase: separator.classList.contains("bg-border"),
      hasUnrelatedBase: separator.classList.contains("shrink-0"),
    }).toStrictEqual({
      hasCaller: true,
      hasConflictingBase: false,
      hasUnrelatedBase: true,
    });
  });
});
