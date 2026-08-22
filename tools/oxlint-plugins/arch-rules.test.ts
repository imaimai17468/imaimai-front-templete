import { describe, expect, it, vi } from "vitest";
import plugin from "./arch-rules.js";

const makeContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

const makeLayerContext = (filename: string | undefined) => ({
  filename,
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

const importNode = (specifier: unknown, importedNames: string[] = []) => ({
  source: { value: specifier },
  specifiers: importedNames.map((name) => ({
    type: "ImportSpecifier",
    imported: { type: "Identifier", name },
  })),
});

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

const reportedMessage = (
  context: ReturnType<typeof makeLayerContext>
): string => context.report.mock.calls[0]?.[0].message ?? "";

const decl = (
  kind: string,
  parentType = "Program",
  init?: { type: string; callee?: { name: string } }
) => ({
  kind,
  parent: { type: parentType },
  declarations: [{ init }],
});

describe("no-module-scope-state", () => {
  const rule = plugin.rules["no-module-scope-state"];

  it("should report when a procedure module declares a reassignable binding", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/middleware.ts");
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.(decl("let"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when the binding is a module-scope constant", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/middleware.ts");
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.(decl("const"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the binding is inside a function body", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/middleware.ts");
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.(decl("let", "BlockStatement"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when an exported module-scope binding is reassignable", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/user.ts");
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.(decl("let", "ExportNamedDeclaration"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a module-scope const holds a mutable cache", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/user.ts");
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.(
      decl("const", "Program", {
        type: "NewExpression",
        callee: { name: "Map" },
      })
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a module-scope const composes the router", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.(
      decl("const", "Program", { type: "ObjectExpression" })
    );

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a const declaration carries no declarator list", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/user.ts");
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.({
      kind: "const",
      parent: { type: "Program" },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when an HTTP handler declares a reassignable binding", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/server/handlers/avatar-read.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.VariableDeclaration?.(decl("let"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should return no visitors when the file is outside the identity layer", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/drizzle/db.ts");

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.VariableDeclaration).toBeUndefined();
  });

  it("should return no visitors when the file is outside src", () => {
    // Arrange
    const context = makeLayerContext("/repo/tools/thing.js");

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.VariableDeclaration).toBeUndefined();
  });

  it("should return no visitors when the filename is unavailable", () => {
    // Arrange
    const context = { ...makeLayerContext(""), filename: undefined };

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.VariableDeclaration).toBeUndefined();
  });
});

describe("layer-boundaries", () => {
  const rule = plugin.rules["layer-boundaries"];

  it("should report when a route imports a gateway via alias", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports drizzle infrastructure via alias", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/drizzle/db"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports a procedure", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/router/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a route imports the Hono app", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/$.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/app"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a route imports a procedure module", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/router"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports an HTTP handler directly", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/$.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/handlers/avatar"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports the session adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports Cloudflare bindings directly", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/cloudflare"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports Cloudflare Workers directly", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("cloudflare:workers"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports getRequest from TanStack Start", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@tanstack/react-start/server", ["getRequest"])
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each(["@/lib/auth/actions"])(
    "should allow the client auth helper %s when a route imports it",
    (specifier) => {
      // Arrange
      const context = makeLayerContext("/repo/src/routes/login.tsx");
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).not.toHaveBeenCalled();
    }
  );

  it.each([
    "@/gateways/avatar",
    "@/lib/auth/session",
    "@/server/cloudflare",
    "cloudflare:workers",
    "@tanstack/react-start/server",
  ])("should report when a route dynamically imports %s", (specifier) => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportExpression?.(importNode(specifier));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a gateway imports a component", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/gateways/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/components/ui/button"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a gateway imports a procedure", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/gateways/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/router/profile"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a gateway imports the session adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/gateways/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a gateway imports an entity", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/gateways/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/entities/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when an entity imports a gateway directory index", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports a route", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/profile"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a procedure imports a route", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/user.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/profile"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a procedure imports a gateway", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/user.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a route imports a gateway via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../gateways/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a route imports a sibling route via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./login"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a relative path escapes the src directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../tools/helper"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when importing a bare package specifier", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("react"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should return no visitors when the file is outside src", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/tools/oxlint-plugins/arch-rules.js"
    );

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ImportDeclaration).toBeUndefined();
  });

  it("should keep the layer message when a layer ban and a protected target overlap", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/components/features/thing/Thing.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(reportedMessage(context)).toContain(
      "Components must not import gateways"
    );
  });

  it("should fall back to the protected-target message when no layer ban covers it", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/unregistered/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(reportedMessage(context)).toContain(
      "Only procedures and HTTP handlers may reach a gateway"
    );
  });

  it("should still guard protected targets when the file is in no chain layer", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/unregistered/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports the raw auth instance", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/auth"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should allow the import when the Hono app mounts the raw auth instance", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/app.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/auth"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should guard a single-file target when the file is in no chain layer", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/unregistered/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should guard the raw auth instance when the file is in no chain layer", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/unregistered/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/auth"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should guard object storage when the file is in no chain layer", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/unregistered/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/storage/r2"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when the session resolver reaches persistence itself", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/session.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/drizzle/db"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when the pure avatar validator reaches a binding", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/lib/storage/avatar-validation.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/cloudflare"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should allow the import when the auth adapter reaches persistence", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/auth.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/drizzle/db"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should refuse the Cloudflare module when the reader is not its single owner", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/unregistered/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("cloudflare:workers"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should allow the import when a sibling file reaches its own gateway module", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/gateways/user/index.test.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should allow the import when a procedure reaches a gateway", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/router/profile.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should allow the import when src/server/cloudflare reads the Cloudflare module", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/server/cloudflare.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("cloudflare:workers"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a component imports a server procedure", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/components/features/profile-page/ProfilePage.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/router/profile"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a component reads Cloudflare bindings", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/components/shared/header/Header.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("cloudflare:workers"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a component imports the client data layer", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/components/features/profile-page/profile-form/ProfileForm.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/client/profile"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component imports the pure avatar validator", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/components/features/profile-page/profile-form/ProfileForm.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/storage/avatar-validation"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when the client layer imports a gateway", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/client/profile.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when the client layer imports a server procedure", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/client/profile.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/server/router/profile"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a component imports the raw auth instance", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/components/shared/header/Header.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/auth"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a component imports the client auth actions", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/components/shared/header/auth-navigation/AuthNavigation.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/actions"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when the client layer imports the raw auth instance", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/client/profile.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/auth"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when the client layer resolves server request context", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/client/profile.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@tanstack/react-start/server"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should return no visitors when filename is unavailable", () => {
    // Arrange
    const context = makeLayerContext(undefined);

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ImportDeclaration).toBeUndefined();
  });

  it("should report when a banned module is re-exported via export-from", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a banned module is re-exported via export-all", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportAllDeclaration?.(importNode("@/gateways/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when an export declaration has no source", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({ source: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the import source value is not a string", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/profile.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode(42));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("no-size-props (defensive branches)", () => {
  const rule = plugin.rules["no-size-props"];

  it("should not report when the attribute has no parent element", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.JSXAttribute({ name: { name: "width" }, parent: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the element name is a namespaced identifier", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: { name: { type: "JSXNamespacedName" } },
    };

    // Act
    visitors.JSXAttribute(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("one-component-per-file (defensive branches)", () => {
  const rule = plugin.rules["one-component-per-file"];

  it("should report when a default-exported component follows an already-exported one", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const named = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "Card" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
      },
    };
    const defaultExport = {
      declaration: { type: "FunctionDeclaration", id: { name: "Page" } },
    };

    // Act
    visitors.ExportNamedDeclaration?.(named);
    visitors.ExportDefaultDeclaration?.(defaultExport);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a named export has no declaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({ declaration: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a named export is a class declaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({
      declaration: { type: "ClassDeclaration", id: { name: "Card" } },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a named export is an anonymous function declaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({
      declaration: { type: "FunctionDeclaration", id: null },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a variable declarator uses a destructuring pattern", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [{ id: { type: "ObjectPattern" } }],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named variable has no initializer", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          { id: { type: "Identifier", name: "Card" }, init: null },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named variable is initialized by a call", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "Card" },
            init: { type: "CallExpression" },
          },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export has no declaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({ declaration: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export is an arrow function", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { type: "ArrowFunctionExpression" },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export is an anonymous function expression", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { type: "FunctionExpression", id: null },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export function has a lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { type: "FunctionDeclaration", id: { name: "helper" } },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("test-naming-format (defensive branches)", () => {
  const rule = plugin.rules["test-naming-format"];

  it("should report when it.only() has a non-conforming name", () => {
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

  it("should report when the member callee has no property and the name is bad", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "it" },
        property: null,
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when it() is called without arguments", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "it" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the test name is a template literal", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "it" },
      arguments: [{ type: "TemplateLiteral" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the test name is a numeric literal", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: { type: "Identifier", name: "it" },
      arguments: [{ type: "Literal", value: 42 }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when it.skip() has a non-conforming name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "it" },
        property: { name: "skip" },
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a non-test object method is called with a bad name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "foo" },
        property: { name: "only" },
      },
      arguments: [{ type: "Literal", value: "bad name" }],
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("single-expect (defensive branches)", () => {
  const rule = plugin.rules["single-expect"];

  const testNode = {
    type: "CallExpression",
    callee: { type: "Identifier", name: "it" },
    arguments: [
      { type: "Literal", value: "should do X when Y" },
      { type: "ArrowFunctionExpression" },
    ],
  };

  it("should not report when a call inside a test has no callee", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const expectNode = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "expect" },
      arguments: [],
    };

    // Act
    visitors.CallExpression(testNode);
    visitors.CallExpression({ type: "CallExpression", callee: null });
    visitors.CallExpression(expectNode);
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a member call inside a test targets a non-expect object", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const memberCall = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "foo" },
        property: { name: "bar" },
      },
    };

    // Act
    visitors.CallExpression(testNode);
    visitors.CallExpression(memberCall);
    visitors.CallExpression(memberCall);
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a member call inside a test has no callee object", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const memberCall = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: null,
        property: { name: "x" },
      },
    };

    // Act
    visitors.CallExpression(testNode);
    visitors.CallExpression(memberCall);
    visitors.CallExpression(memberCall);
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not track a test call when it has no callback", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const bareTest = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "it" },
      arguments: [{ type: "Literal", value: "should do X when Y" }],
    };

    // Act
    visitors.CallExpression(bareTest);
    visitors["CallExpression:exit"](bareTest);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not track a test call when its second argument is not a function", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const stringTest = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "it" },
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "Literal", value: "not a function" },
      ],
    };

    // Act
    visitors.CallExpression(stringTest);
    visitors["CallExpression:exit"](stringTest);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should ignore an exit event when the call is not a test", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const plainCall = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "helper" },
    };

    // Act
    visitors["CallExpression:exit"](plainCall);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should ignore an exit event when no test scope was entered", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when member-style expect calls exceed one inside a test", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const softExpect = {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: { type: "Identifier", name: "expect" },
        property: { name: "soft" },
      },
    };

    // Act
    visitors.CallExpression(testNode);
    visitors.CallExpression(softExpect);
    visitors.CallExpression(softExpect);
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });
});

describe("component-file-naming (defensive branches)", () => {
  const rule = plugin.rules["component-file-naming"];

  it("should return no visitors when the context has no filename source", () => {
    // Arrange
    const context = makeContext();

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ExportNamedDeclaration).toBeUndefined();
  });

  it("should use getFilename when the filename property is absent", () => {
    // Arrange
    const context = {
      ...makeContext(),
      getFilename: () => "/src/components/Card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "Other" } },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should return no visitors when the filename ends with a slash", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/" };

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ExportNamedDeclaration).toBeUndefined();
  });

  it("should skip the empty leading segment when the file name starts with a dot", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/.card.tsx" };
    const visitors = rule.create(context);
    const node = {
      declaration: { type: "FunctionDeclaration", id: { name: "Other" } },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should return no visitors when the expected name is not component-like", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/lib/_helpers.ts" };

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ExportNamedDeclaration).toBeUndefined();
  });

  it("should not report when a named export has no declaration", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({ declaration: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a named export is a type alias", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({
      declaration: { type: "TSTypeAliasDeclaration" },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a variable declarator uses a destructuring pattern", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [{ id: { type: "ObjectPattern" } }],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a lowercase variable is exported", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "helper" },
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

  it("should not report when a component-named variable has no initializer", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          { id: { type: "Identifier", name: "Other" }, init: null },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named variable is initialized by a call", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "Other" },
            init: { type: "CallExpression" },
          },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export has no declaration", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({ declaration: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export is an arrow function", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { type: "ArrowFunctionExpression" },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export is an anonymous function expression", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { type: "FunctionExpression", id: null },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when an exported arrow component does not match the file name", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        type: "VariableDeclaration",
        declarations: [
          {
            id: { type: "Identifier", name: "Other" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a default-exported function does not match the file name", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/components/Card.tsx" };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { type: "FunctionDeclaration", id: { name: "Other" } },
    });

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });
});
