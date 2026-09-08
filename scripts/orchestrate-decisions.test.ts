import { describe, expect, it } from "vite-plus/test";
import {
  formatEvent,
  freeGibFromFreeB,
  freeGibFromMemoryPressure,
  prNumbers,
  watchEvent,
} from "./orchestrate-decisions";
import type { PrRow } from "./orchestrate-decisions";

const GIB = 1024 ** 3;

describe(freeGibFromMemoryPressure, () => {
  it("should multiply the free percentage by the machine's memory when the percentage line is present", () => {
    const output = "Pageouts: 0\n\nSystem-wide memory free percentage: 50%\n";

    const gib = freeGibFromMemoryPressure(output, 64 * GIB);

    expect(gib).toBe(32);
  });

  it("should return undefined when the percentage line is absent", () => {
    const gib = freeGibFromMemoryPressure(
      "The system has 2 memory pressure levels\n",
      64 * GIB
    );

    expect(gib).toBeUndefined();
  });
});

describe(freeGibFromFreeB, () => {
  it("should read the available column when a Mem row is present", () => {
    const output = [
      "               total        used        free      shared  buff/cache   available",
      `Mem:     ${8 * GIB}  ${2 * GIB}  ${1 * GIB}  0  ${5 * GIB}  ${6 * GIB}`,
      "Swap:              0           0           0",
    ].join("\n");

    const gib = freeGibFromFreeB(output);

    expect(gib).toBe(6);
  });

  it("should return undefined when no Mem row is present", () => {
    const gib = freeGibFromFreeB("free: command not found\n");

    expect(gib).toBeUndefined();
  });
});

const row = (
  number: number,
  mergeable = "MERGEABLE",
  state = "OPEN"
): PrRow => ({
  mergeable,
  number,
  state,
});

describe(watchEvent, () => {
  it("should report all-closed when no watched PR is listed", () => {
    const event = watchEvent([12, 15], [row(99)]);

    expect(event).toStrictEqual({ kind: "all-closed" });
  });

  it("should report all-closed when the watched PRs are listed with a state other than OPEN", () => {
    const event = watchEvent([12], [row(12, "UNKNOWN", "MERGED")]);

    expect(event).toStrictEqual({ kind: "all-closed" });
  });

  it("should name every watched PR when its mergeable is CONFLICTING", () => {
    const event = watchEvent(
      [12, 15, 18],
      [row(12, "CONFLICTING"), row(15), row(18, "CONFLICTING")]
    );

    expect(event).toStrictEqual({ kind: "conflict", numbers: [12, 18] });
  });

  it("should return undefined when the only conflicting PR is one the run does not watch", () => {
    const event = watchEvent([12], [row(12), row(99, "CONFLICTING")]);

    expect(event).toBeUndefined();
  });

  it("should return undefined when a watched PR is open and mergeable", () => {
    const event = watchEvent([12], [row(12)]);

    expect(event).toBeUndefined();
  });
});

describe(formatEvent, () => {
  it("should print all-closed when the event is all-closed", () => {
    const line = formatEvent({ kind: "all-closed" });

    expect(line).toBe("all-closed");
  });

  it("should print conflict followed by the PR numbers when the event is a conflict", () => {
    const line = formatEvent({ kind: "conflict", numbers: [12, 18] });

    expect(line).toBe("conflict 12 18");
  });
});

describe(prNumbers, () => {
  it("should return the parsed numbers when every argument is a positive integer", () => {
    const numbers = prNumbers(["12", "15"]);

    expect(numbers).toStrictEqual([12, 15]);
  });

  it("should return undefined when no argument is given", () => {
    const numbers = prNumbers([]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is not a number", () => {
    const numbers = prNumbers(["12", "main"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument has a fractional part", () => {
    const numbers = prNumbers(["1.5"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is zero or negative", () => {
    const numbers = prNumbers(["0"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is not finite", () => {
    const numbers = prNumbers(["Infinity"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is written in hexadecimal", () => {
    const numbers = prNumbers(["0x10"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is written in exponent notation", () => {
    const numbers = prNumbers(["1e3"]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument is padded with spaces", () => {
    const numbers = prNumbers([" 12 "]);

    expect(numbers).toBeUndefined();
  });

  it("should return undefined when an argument exceeds the safe integer range", () => {
    const numbers = prNumbers(["9007199254740993"]);

    expect(numbers).toBeUndefined();
  });
});
