import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./no-loops.js";

const createMockContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

describe("no-loops", () => {
  it("should report when a ForStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "ForStatement" };
    visitors.ForStatement(node);
    expect(context.report).toHaveBeenCalledExactlyOnceWith({
      message: expect.stringContaining("Loops are forbidden"),
      node,
    });
  });

  it("should report when a ForInStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "ForInStatement" };
    visitors.ForInStatement(node);
    expect(context.report).toHaveBeenCalledExactlyOnceWith({
      message: expect.stringContaining("Loops are forbidden"),
      node,
    });
  });

  it("should report when a ForOfStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "ForOfStatement" };
    visitors.ForOfStatement(node);
    expect(context.report).toHaveBeenCalledExactlyOnceWith({
      message: expect.stringContaining("Loops are forbidden"),
      node,
    });
  });

  it("should report when a WhileStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "WhileStatement" };
    visitors.WhileStatement(node);
    expect(context.report).toHaveBeenCalledExactlyOnceWith({
      message: expect.stringContaining("Loops are forbidden"),
      node,
    });
  });

  it("should report when a DoWhileStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "DoWhileStatement" };
    visitors.DoWhileStatement(node);
    expect(context.report).toHaveBeenCalledExactlyOnceWith({
      message: expect.stringContaining("Loops are forbidden"),
      node,
    });
  });
});
