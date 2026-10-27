import { describe, expect, it } from "vite-plus/test";
import { formatRegisteredOn } from "./registered-on";

describe(formatRegisteredOn, () => {
  it("should show the next day when the instant is past midnight in Tokyo but not in UTC", () => {
    expect(formatRegisteredOn("2024-01-01T15:30:00.000Z")).toBe("2024/1/2");
  });

  it("should show the UTC day when the instant is one millisecond before midnight in Tokyo", () => {
    expect(formatRegisteredOn("2024-01-01T14:59:59.999Z")).toBe("2024/1/1");
  });
});
