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
    render(
      <>
        <Badge>Plain</Badge>
        <Badge className="rounded-md">Tag</Badge>
      </>
    );

    const plain = screen.getByText("Plain");
    const overridden = screen.getByText("Tag");

    expect({
      plainHasConflictingBase: plain.classList.contains("rounded-full"),
      overriddenHasCaller: overridden.classList.contains("rounded-md"),
      overriddenHasConflictingBase:
        overridden.classList.contains("rounded-full"),
      overriddenHasUnrelatedBase: overridden.classList.contains("inline-flex"),
    }).toStrictEqual({
      plainHasConflictingBase: true,
      overriddenHasCaller: true,
      overriddenHasConflictingBase: false,
      overriddenHasUnrelatedBase: true,
    });
  });
});
