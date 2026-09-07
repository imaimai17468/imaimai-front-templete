import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Badge } from "./badge";

describe(Badge, () => {
  it("should render a span when asChild is omitted", () => {
    render(<Badge>New</Badge>);

    const badge = screen.getByText("New");

    expect({
      tagName: badge.tagName,
      slot: badge.dataset.slot,
      variant: badge.dataset.variant,
    }).toStrictEqual({ tagName: "SPAN", slot: "badge", variant: "default" });
  });

  it("should render the child element when asChild is true", () => {
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

  it("should keep the caller's class when className conflicts with a variant class", () => {
    render(<Badge className="rounded-md">Tag</Badge>);

    const badge = screen.getByText("Tag");

    expect({
      hasCaller: badge.classList.contains("rounded-md"),
      hasVariant: badge.classList.contains("rounded-full"),
    }).toStrictEqual({ hasCaller: true, hasVariant: false });
  });
});
