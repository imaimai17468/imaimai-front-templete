import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { Alert, AlertDescription, AlertTitle } from "./alert";

describe(Alert, () => {
  it("should render an alert-role div with the default variant colors when variant is omitted", () => {
    render(<Alert>Backup finished</Alert>);

    const alert = screen.getByRole("alert");

    expect({
      tagName: alert.tagName,
      slot: alert.dataset.slot,
      hasDefault: alert.classList.contains("text-card-foreground"),
      hasDestructive: alert.classList.contains("text-destructive"),
    }).toStrictEqual({
      tagName: "DIV",
      slot: "alert",
      hasDefault: true,
      hasDestructive: false,
    });
  });

  it("should render the destructive colors when variant is destructive", () => {
    render(<Alert variant="destructive">Backup failed</Alert>);

    const alert = screen.getByRole("alert");

    expect({
      slot: alert.dataset.slot,
      hasDefault: alert.classList.contains("text-card-foreground"),
      hasDestructive: alert.classList.contains("text-destructive"),
    }).toStrictEqual({
      slot: "alert",
      hasDefault: false,
      hasDestructive: true,
    });
  });

  it("should keep the caller's class when className conflicts with a base class", () => {
    render(<Alert className="rounded-none">Backup queued</Alert>);

    const alert = screen.getByRole("alert");

    expect({
      hasCaller: alert.classList.contains("rounded-none"),
      hasBase: alert.classList.contains("rounded-lg"),
    }).toStrictEqual({ hasCaller: true, hasBase: false });
  });
});

describe(AlertTitle, () => {
  it("should render a div with the alert-title slot when className is omitted", () => {
    render(<AlertTitle>Update available</AlertTitle>);

    const title = screen.getByText("Update available");

    expect({
      tagName: title.tagName,
      slot: title.dataset.slot,
    }).toStrictEqual({ tagName: "DIV", slot: "alert-title" });
  });

  it("should keep the caller's class when className conflicts with a base class", () => {
    render(<AlertTitle className="font-bold">Update available</AlertTitle>);

    const title = screen.getByText("Update available");

    expect({
      hasCaller: title.classList.contains("font-bold"),
      hasBase: title.classList.contains("font-medium"),
    }).toStrictEqual({ hasCaller: true, hasBase: false });
  });
});

describe(AlertDescription, () => {
  it("should render a div with the alert-description slot when className is omitted", () => {
    render(<AlertDescription>Version 2 is ready</AlertDescription>);

    const description = screen.getByText("Version 2 is ready");

    expect({
      tagName: description.tagName,
      slot: description.dataset.slot,
    }).toStrictEqual({ tagName: "DIV", slot: "alert-description" });
  });

  it("should keep the caller's class when className conflicts with a base class", () => {
    render(
      <AlertDescription className="text-base">
        Version 2 is ready
      </AlertDescription>
    );

    const description = screen.getByText("Version 2 is ready");

    expect({
      hasCaller: description.classList.contains("text-base"),
      hasBase: description.classList.contains("text-sm"),
    }).toStrictEqual({ hasCaller: true, hasBase: false });
  });
});
