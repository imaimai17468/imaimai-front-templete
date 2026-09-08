import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Badge } from "./badge";

describe(Badge, () => {
  it("should render a span with the default variant when asChild and variant are omitted", () => {
    render(<Badge>New</Badge>);

    const badge = screen.getByText("New");

    expect({
      tagName: badge.tagName,
      slot: badge.dataset.slot,
      variant: badge.dataset.variant,
    }).toStrictEqual({ tagName: "SPAN", slot: "badge", variant: "default" });
  });

  it("should render the child element with the given variant when asChild is true", () => {
    render(
      <Badge asChild variant="outline">
        <a href="/releases">Releases</a>
      </Badge>
    );

    const badge = screen.getByRole("link", { name: "Releases" });

    expect({
      tagName: badge.tagName,
      slot: badge.dataset.slot,
      variant: badge.dataset.variant,
    }).toStrictEqual({ tagName: "A", slot: "badge", variant: "outline" });
  });

  it("should drop only the conflicting base class when className overrides one of them", () => {
    render(<Badge className="rounded-md">Tag</Badge>);

    const badge = screen.getByText("Tag");

    expect({
      hasCaller: badge.classList.contains("rounded-md"),
      hasConflictingBase: badge.classList.contains("rounded-full"),
      hasUnrelatedBase: badge.classList.contains("inline-flex"),
    }).toStrictEqual({
      hasCaller: true,
      hasConflictingBase: false,
      hasUnrelatedBase: true,
    });
  });
});
