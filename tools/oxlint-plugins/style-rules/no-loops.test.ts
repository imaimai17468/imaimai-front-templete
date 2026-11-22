import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./no-loops.js";

const createMockContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

describe("no-loops", () => {
  it.each([
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
  ] as const)("should report when a %s is encountered", (type) => {
    const context = createMockContext();
    const node = { type };
    rule.create(context)[type](node);
    expect(context.report).toHaveBeenCalledExactlyOnceWith({
      message: expect.stringContaining("Loops are forbidden"),
      node,
    });
  });
});
