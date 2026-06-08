import { describe, expect, it, vi } from "vitest";
import plugin from "./style-rules.js";

const createMockContext = () => ({
  report: vi.fn(),
});

const makeClassNameNode = (value: string) => ({
  name: { name: "className" },
  value: {
    type: "Literal" as const,
    value,
  },
});

const makeClassNameStringLiteralNode = (value: string) => ({
  name: { name: "className" },
  value: {
    type: "StringLiteral" as const,
    value,
  },
});

const makeClassNameTemplateNode = (raw: string) => ({
  name: { name: "className" },
  value: {
    type: "JSXExpressionContainer" as const,
    expression: {
      type: "TemplateLiteral" as const,
      quasis: [{ value: { raw } }],
    },
  },
});

const makeClassNameExpressionLiteralNode = (value: string) => ({
  name: { name: "className" },
  value: {
    type: "JSXExpressionContainer" as const,
    expression: {
      type: "Literal" as const,
      value,
    },
  },
});

const makeClassNameExpressionStringLiteralNode = (value: string) => ({
  name: { name: "className" },
  value: {
    type: "JSXExpressionContainer" as const,
    expression: {
      type: "StringLiteral" as const,
      value,
    },
  },
});

const makeNonClassNameNode = (attrName: string, value: string) => ({
  name: { name: attrName },
  value: {
    type: "Literal" as const,
    value,
  },
});

describe("no-loops", () => {
  const rule = plugin.rules["no-loops"];

  it("should report when a ForStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "ForStatement" };
    visitors.ForStatement(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a ForInStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "ForInStatement" };
    visitors.ForInStatement(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a ForOfStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "ForOfStatement" };
    visitors.ForOfStatement(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a WhileStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "WhileStatement" };
    visitors.WhileStatement(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a DoWhileStatement is encountered", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = { type: "DoWhileStatement" };
    visitors.DoWhileStatement(node);
    expect(context.report).toHaveBeenCalledOnce();
  });
});

describe("no-tailwind-arbitrary", () => {
  const rule = plugin.rules["no-tailwind-arbitrary"];

  it("should report when className Literal contains an arbitrary value", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameNode("w-[327px] text-sm");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when className StringLiteral contains an arbitrary value", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameStringLiteralNode("text-[13px]");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report for each arbitrary value when className contains multiple arbitrary values", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameNode("w-[327px] text-[13px]");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledTimes(2);
  });

  it("should report when className TemplateLiteral quasis contain an arbitrary value", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameTemplateNode("bg-[#1a1a1a] rounded-lg");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when className Literal contains no arbitrary values", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameNode("w-80 text-sm bg-background rounded-lg");
    visitors.JSXAttribute(node);
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when className TemplateLiteral quasis contain no arbitrary values", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameTemplateNode("flex items-center gap-4");
    visitors.JSXAttribute(node);
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when className JSXExpressionContainer string literal contains an arbitrary value", () => {
    // Arrange
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameExpressionLiteralNode("p-[20px] flex");

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when className JSXExpressionContainer string literal contains no arbitrary values", () => {
    // Arrange
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameExpressionLiteralNode("flex items-center");

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when className JSXExpressionContainer StringLiteral contains an arbitrary value", () => {
    // Arrange
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameExpressionStringLiteralNode("m-[10px]");

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when the JSXAttribute is not className", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeNonClassNameNode("data-value", "w-[327px]");
    visitors.JSXAttribute(node);
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("no-tailwind-opacity", () => {
  const rule = plugin.rules["no-tailwind-opacity"];

  it("should report when className Literal contains an opacity modifier", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameNode("text-gray-800/80");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when className StringLiteral contains an opacity modifier", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameStringLiteralNode("bg-blue-600/50");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report for each opacity modifier when className contains multiple opacity modifiers", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameNode("text-gray-800/80 bg-blue-600/50");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledTimes(2);
  });

  it("should report when className TemplateLiteral quasis contain an opacity modifier", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameTemplateNode("border-red-500/30 flex");
    visitors.JSXAttribute(node);
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when className Literal contains no opacity modifier", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameNode("text-gray-800 bg-blue-600");
    visitors.JSXAttribute(node);
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when className TemplateLiteral quasis contain no opacity modifier", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameTemplateNode("flex items-center gap-4");
    visitors.JSXAttribute(node);
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when className contains a hyphenated utility with opacity modifier", () => {
    // Arrange
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameNode("bg-gradient-to-r/50");

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when className JSXExpressionContainer string literal contains an opacity modifier", () => {
    // Arrange
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameExpressionLiteralNode("text-gray-800/80");

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when className JSXExpressionContainer string literal contains no opacity modifier", () => {
    // Arrange
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameExpressionLiteralNode(
      "text-gray-800 bg-blue-600"
    );

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when className JSXExpressionContainer StringLiteral contains an opacity modifier", () => {
    // Arrange
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeClassNameExpressionStringLiteralNode("border-red-500/30");

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when the JSXAttribute is not className", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = makeNonClassNameNode("id", "text-gray-800/80");
    visitors.JSXAttribute(node);
    expect(context.report).not.toHaveBeenCalled();
  });
});
