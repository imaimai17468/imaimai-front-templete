import { describe, expect, it } from "vitest";
import { formatJapanTime } from "./utils";

describe("formatJapanTime", () => {
  it("should format UTC date in Asia/Tokyo timezone when given a UTC Date", () => {
    // Arrange
    const date = new Date("2026-01-02T03:04:05Z");

    // Act
    const result = formatJapanTime(date);

    // Assert
    expect(result).toBe("2026/01/02 12:04:05");
  });
});
