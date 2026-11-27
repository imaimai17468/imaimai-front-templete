import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./component-file-naming.js";

const makeContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

describe("component-file-naming", () => {
  it("should not report when component name matches file name", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/StatsCard/StatsCard.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "StatsCard" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when component name matches kebab-case file name", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/stats-card/stats-card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "StatsCard" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when component name does not match kebab-case file name", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/stats-card/stats-card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "UserCard" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report the found and expected names on the export when component name does not match file name", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/StatsCard/StatsCard.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "UserCard" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report.mock.calls).toStrictEqual([
      [
        {
          message:
            "Component name 'UserCard' does not match file name. Expected 'StatsCard'.",
          node,
        },
      ],
    ]);
  });

  it("should not report when component name matches container file convention", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/StatsCard/StatsCard.container.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        id: { name: "StatsCardContainer" },
        type: "FunctionDeclaration",
      },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when file is index", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/index.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "Anything" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when file is a test file", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/StatsCard/StatsCard.test.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "Anything" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when lowercase function is exported", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/StatsCard/StatsCard.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "helperFn" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("component-file-naming (defensive branches)", () => {
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
      getFilename: () => "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "Other" }, type: "FunctionDeclaration" },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should return no visitors when the filename ends with a slash", () => {
    // Arrange
    const context = { ...makeContext(), filename: "/src/shared/components/" };

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ExportNamedDeclaration).toBeUndefined();
  });

  it("should skip the empty leading segment when the file name starts with a dot", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/.card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "Other" }, type: "FunctionDeclaration" },
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
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({ declaration: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a named export is a type alias", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
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
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        declarations: [{ id: { type: "ObjectPattern" } }],
        type: "VariableDeclaration",
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a lowercase variable is exported", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        declarations: [
          {
            id: { name: "helper", type: "Identifier" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
        type: "VariableDeclaration",
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named variable has no initializer", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        declarations: [
          { id: { name: "Other", type: "Identifier" }, init: null },
        ],
        type: "VariableDeclaration",
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named variable is initialized by a call", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        declarations: [
          {
            id: { name: "Other", type: "Identifier" },
            init: { type: "CallExpression" },
          },
        ],
        type: "VariableDeclaration",
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export has no declaration", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({ declaration: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export is an arrow function", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
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
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { id: null, type: "FunctionExpression" },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when an exported arrow component does not match the file name", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: {
        declarations: [
          {
            id: { name: "Other", type: "Identifier" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
        type: "VariableDeclaration",
      },
    };

    // Act
    visitors.ExportNamedDeclaration?.(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a default-exported function does not match the file name", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { id: { name: "Other" }, type: "FunctionDeclaration" },
    });

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a default-exported named function expression does not match the file name", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { id: { name: "Other" }, type: "FunctionExpression" },
    });

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a default-exported class does not match the file name", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportDefaultDeclaration?.({
      declaration: { id: { name: "Other" }, type: "ClassDeclaration" },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when an exported class does not match the file name", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({
      declaration: { id: { name: "Other" }, type: "ClassDeclaration" },
    });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when an exported function-expression component does not match the file name", () => {
    // Arrange
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/Card.tsx",
    };
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({
      declaration: {
        declarations: [
          {
            id: { name: "Other", type: "Identifier" },
            init: { type: "FunctionExpression" },
          },
        ],
        type: "VariableDeclaration",
      },
    });

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });
});
