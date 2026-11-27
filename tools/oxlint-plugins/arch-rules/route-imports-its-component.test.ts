import { describe, expect, it, vi } from "vite-plus/test";
import rule from "./route-imports-its-component.js";

const makeLayerContext = (filename?: string) => ({
  filename,
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

interface InitFixture {
  type: string;
  body?: unknown;
  callee?: { name?: string; type?: string; property?: { name: string } };
  arguments?: { type: string }[];
}

interface DeclaratorFixture {
  id?: { name?: string; type?: string } | null;
  init?: InitFixture | null;
}

/**
 * A module-scope statement, carrying the fields `route-imports-its-component`
 * reads and no others, so a fixture cannot satisfy the rule by a field it
 * ignores.
 */
interface StatementFixture {
  type: string;
  id?: { name?: string } | null;
  declaration?: StatementFixture | null;
  declarations?: DeclaratorFixture[];
  source?: { value: string };
}

/** A `Program` whose body is the module-scope statements passed to it. */
const moduleBody = (...body: StatementFixture[]) => ({ body, type: "Program" });

const arrowDeclarator = (name: string) => ({
  id: { name, type: "Identifier" },
  init: { type: "ArrowFunctionExpression" },
});

const arrowDeclaration = (name: string) => ({
  declarations: [arrowDeclarator(name)],
  type: "VariableDeclaration",
});

/** A `Page` declarator whose value is built by calling `callee`. */
const wrapped = (
  callee: NonNullable<InitFixture["callee"]>,
  argument: { type: string }
): StatementFixture => ({
  declarations: [
    {
      id: { name: "Page", type: "Identifier" },
      init: { arguments: [argument], callee, type: "CallExpression" },
    },
  ],
  type: "VariableDeclaration",
});

const arrow = { type: "ArrowFunctionExpression" };

describe("route-imports-its-component", () => {
  it("should report when a route file declares the component it draws", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/index/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(moduleBody(arrowDeclaration("HomeComponent")));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should name the component and its destination on the declaring statement when it reports a route file", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/index/route.tsx");
    const visitors = rule.create(context);
    const statement = arrowDeclaration("HomeComponent");

    // Act
    visitors.Program?.(moduleBody(statement));

    // Assert
    expect(context.report.mock.calls).toStrictEqual([
      [
        {
          message:
            "A route file declares 'Route' and imports what it draws. Move 'HomeComponent' to a '-components/' directory beside this file and import it.",
          node: statement,
        },
      ],
    ]);
  });

  it("should report when the root route file declares its layout", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/__root.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(moduleBody(arrowDeclaration("RootComponent")));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a route file declares Route alone", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/index/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(
      moduleBody({
        declarations: [
          {
            id: { name: "Route", type: "Identifier" },
            init: { type: "CallExpression" },
          },
        ],
        type: "VariableDeclaration",
      })
    );

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the component sits in the route's private directory", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/index/-components/home-page.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(moduleBody(arrowDeclaration("HomePage")));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a route file is a test", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/-avatars.test.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(moduleBody(arrowDeclaration("Stub")));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the file sits outside src", () => {
    // Arrange
    const context = makeLayerContext();
    const visitors = rule.create(context);

    // Assert
    expect(visitors.Program).toBeUndefined();
  });

  it("should not report when the file sits outside the route layer", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/components/header/header.tsx"
    );
    const visitors = rule.create(context);

    // Assert
    expect(visitors.Program).toBeUndefined();
  });

  it.each<{ name: string; statement: StatementFixture; reports: number }>([
    {
      name: "should report when a component is a function declaration",
      reports: 1,
      statement: { id: { name: "Page" }, type: "FunctionDeclaration" },
    },
    {
      name: "should report when a component is a named default-exported function expression",
      reports: 1,
      statement: {
        declaration: { id: { name: "Page" }, type: "FunctionExpression" },
        type: "ExportDefaultDeclaration",
      },
    },
    {
      name: "should report when a component is exported by name",
      reports: 1,
      statement: {
        declaration: arrowDeclaration("Page"),
        type: "ExportNamedDeclaration",
      },
    },
    {
      name: "should report when a component is a function expression bound to a name",
      reports: 1,
      statement: {
        declarations: [
          {
            id: { name: "Page", type: "Identifier" },
            init: { type: "FunctionExpression" },
          },
        ],
        type: "VariableDeclaration",
      },
    },
    {
      name: "should report when a component is wrapped in memo",
      reports: 1,
      statement: wrapped({ name: "memo", type: "Identifier" }, arrow),
    },
    {
      name: "should report when a component is wrapped in React.forwardRef",
      reports: 1,
      statement: wrapped(
        { property: { name: "forwardRef" }, type: "MemberExpression" },
        arrow
      ),
    },
    {
      name: "should not report when memo wraps something that is not a function",
      reports: 0,
      statement: wrapped(
        { name: "memo", type: "Identifier" },
        { type: "Identifier" }
      ),
    },
    {
      name: "should not report when a wrapper is constructed with new rather than called",
      reports: 0,
      statement: {
        declarations: [
          {
            id: { name: "Page", type: "Identifier" },
            init: {
              arguments: [arrow],
              callee: { name: "memo", type: "Identifier" },
              type: "NewExpression",
            },
          },
        ],
        type: "VariableDeclaration",
      },
    },
    {
      name: "should not report when a component-named variable is declared without a value",
      reports: 0,
      statement: {
        declarations: [
          { id: { name: "Page", type: "Identifier" }, init: null },
        ],
        type: "VariableDeclaration",
      },
    },
    {
      name: "should not report when a lowercase name is bound to an arrow function",
      reports: 0,
      statement: arrowDeclaration("helper"),
    },
    {
      name: "should not report when a call that is not a component wrapper builds the value",
      reports: 0,
      statement: wrapped({ type: "CallExpression" }, arrow),
    },
    {
      name: "should not report when an export lists names without declaring one",
      reports: 0,
      statement: { declaration: null, type: "ExportNamedDeclaration" },
    },
    {
      name: "should not report when a function declaration has no name",
      reports: 0,
      statement: { id: null, type: "FunctionDeclaration" },
    },
    {
      name: "should not report when a function declaration has a lowercase name",
      reports: 0,
      statement: { id: { name: "helper" }, type: "FunctionDeclaration" },
    },
    {
      name: "should not report when a declarator destructures instead of naming",
      reports: 0,
      statement: {
        declarations: [
          {
            id: { type: "ObjectPattern" },
            init: { type: "ArrowFunctionExpression" },
          },
        ],
        type: "VariableDeclaration",
      },
    },
    {
      name: "should not report when a statement is neither a function nor a variable",
      reports: 0,
      statement: { type: "ClassDeclaration" },
    },
  ])("$name", ({ reports, statement }) => {
    const context = makeLayerContext("/repo/src/routes/index/route.tsx");

    rule.create(context).Program?.(moduleBody(statement));

    expect(context.report).toHaveBeenCalledTimes(reports);
  });
});
