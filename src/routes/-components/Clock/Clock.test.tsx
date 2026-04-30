import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Clock } from "./Clock";

describe("Clock", () => {
  it("should render the time inside a timer role when given a time string", () => {
    // Arrange & Act
    render(<Clock time="2026/04/23 10:20:30" />);

    // Assert
    expect(screen.getByRole("timer").textContent).toBe("2026/04/23 10:20:30");
  });
});
