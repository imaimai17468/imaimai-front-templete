import { describe, expect, it, vi } from "vitest";
import plugin from "./arch-rules.js";

const makeContext = () => ({ report: vi.fn() });

describe("no-size-props", () => {
  const rule = plugin.rules["no-size-props"];

  it("should report when width prop is on a custom component with uppercase JSXIdentifier", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: { type: "JSXIdentifier", name: "Card" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when height prop is on a custom component with uppercase JSXIdentifier", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "height" },
      parent: {
        name: { type: "JSXIdentifier", name: "Avatar" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when width prop is on a JSXMemberExpression element", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: {
          type: "JSXMemberExpression",
          object: { name: "Icons" },
          property: { name: "Arrow" },
        },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when height prop is on a JSXMemberExpression element", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "height" },
      parent: {
        name: {
          type: "JSXMemberExpression",
          object: { name: "UI" },
          property: { name: "Box" },
        },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when width prop is on an HTML element with lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: { type: "JSXIdentifier", name: "img" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when height prop is on an HTML element with lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "height" },
      parent: {
        name: { type: "JSXIdentifier", name: "div" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when className prop is on a custom component", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      parent: {
        name: { type: "JSXIdentifier", name: "Card" },
      },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("one-component-per-file", () => {
  const rule = plugin.rules["one-component-per-file"];

  it("should not report when only one component is exported via FunctionDeclaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "MyComponent" } },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report on the second exported component when using FunctionDeclaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const firstNode = {
      declaration: { type: "FunctionDeclaration", id: { name: "ComponentA" } },
    };
    const secondNode = {
      declaration: { type: "FunctionDeclaration", id: { name: "ComponentB" } },
    };

    // Act
    visitors.ExportNamedDeclaration?.(firstNode);
    visitors.ExportNamedDeclaration?.(secondNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when only one component is exported via VariableDeclaration with ArrowFunctionExpression", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "MyComponent" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when second component is exported via VariableDeclaration with ArrowFunctionExpression", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const firstNode = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "ComponentA" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
      },
    };
    const secondNode = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "ComponentB" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(firstNode);
    visitors.ExportNamedDeclaration?.(secondNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when export has a lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "helperFn" } },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when export is a hook starting with use", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "useMyHook" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("test-naming-format", () => {
  const rule = plugin.rules["test-naming-format"];

  it("should report when it() test name does not follow should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "it" },
      arguments: [{ type: "Literal", value: "renders the component" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when test() test name does not follow should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "test" },
      arguments: [{ type: "Literal", value: "returns the correct value" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when it() test name follows the should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "it" },
      arguments: [
        { type: "Literal", value: "should return true when input is valid" },
      ],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when test() test name follows the should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "test" },
      arguments: [
        {
          type: "Literal",
          value: "should render correctly when props are provided",
        },
      ],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when callee is describe", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "describe" },
      arguments: [{ type: "Literal", value: "MyComponent" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when callee is it.each", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { name: "it" },
        property: { name: "each" },
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when callee is it.skip", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { name: "it" },
        property: { name: "skip" },
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when callee is it.todo", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { name: "it" },
        property: { name: "todo" },
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when it.only() test name does not follow should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "it" },
        property: { name: "only" },
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when test.only() test name does not follow should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "test" },
        property: { name: "only" },
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });
});

describe("component-file-naming", () => {
  const rule = plugin.rules["component-file-naming"];

  it("should not report when component name matches file name", () => {
    const context = {
      ...makeContext(),
      filename: "/src/components/StatsCard/StatsCard.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "StatsCard" } },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when component name does not match file name", () => {
    const context = {
      ...makeContext(),
      filename: "/src/components/StatsCard/StatsCard.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "UserCard" } },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when component name matches container file convention", () => {
    const context = {
      ...makeContext(),
      filename: "/src/components/StatsCard/StatsCard.container.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "FunctionDeclaration",
        id: { name: "StatsCardContainer" },
      },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when file is index", () => {
    const context = { ...makeContext(), filename: "/src/components/index.tsx" };
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "Anything" } },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when file is a test file", () => {
    const context = {
      ...makeContext(),
      filename: "/src/components/StatsCard/StatsCard.test.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "Anything" } },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when lowercase function is exported", () => {
    const context = {
      ...makeContext(),
      filename: "/src/components/StatsCard/StatsCard.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "helperFn" } },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("single-expect", () => {
  const rule = plugin.rules["single-expect"];

  it("should not report when test has exactly one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const itNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "it" },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
    };
    const expectNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "expect" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(itNode);
    visitors.CallExpression(expectNode);
    visitors["CallExpression:exit"](itNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when test has more than one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const itNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "it" },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
    };
    const expectNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "expect" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(itNode);
    visitors.CallExpression(expectNode);
    visitors.CallExpression(expectNode);
    visitors["CallExpression:exit"](itNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when test() block has more than one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const testNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "test" },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
    };
    const expectNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "expect" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(testNode);
    visitors.CallExpression(expectNode);
    visitors.CallExpression(expectNode);
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when it.each() is used", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const eachNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { name: "it" },
        property: { name: "each" },
      },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
    };

    // Act
    visitors.CallExpression(eachNode);
    visitors["CallExpression:exit"](eachNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when it.only() has more than one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const onlyNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "it" },
        property: { name: "only" },
      },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
    };
    const expectNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "expect" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(onlyNode);
    visitors.CallExpression(expectNode);
    visitors.CallExpression(expectNode);
    visitors["CallExpression:exit"](onlyNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when it.skip() is used", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const skipNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "it" },
        property: { name: "skip" },
      },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
    };
    const expectNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "expect" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(skipNode);
    visitors.CallExpression(expectNode);
    visitors.CallExpression(expectNode);
    visitors["CallExpression:exit"](skipNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when test.todo() is used", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const todoNode = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "test" },
        property: { name: "todo" },
      },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
    };
    const expectNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "expect" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(todoNode);
    visitors.CallExpression(expectNode);
    visitors["CallExpression:exit"](todoNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});
