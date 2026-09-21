import { describe, expect, it, vi } from "vite-plus/test";
import plugin from "./arch-rules.js";

const makeContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

const makeLayerContext = (filename?: string) => ({
  filename,
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
});

// A non-string source is what the plugin's own guard rejects, so the fixture
// has to be able to produce one.
type ImportSource = string | number;

/** A `Program` node holding the import declarations a module opens with. */
const programNode = (
  sources: (string | { importKind: string; value: string })[]
) => ({
  body: sources.map((source) =>
    typeof source === "string"
      ? { source: { value: source }, type: "ImportDeclaration" }
      : {
          importKind: source.importKind,
          source: { value: source.value },
          type: "ImportDeclaration",
        }
  ),
  type: "Program",
});

interface DeclaratorFixture {
  id?: { name?: string; type?: string } | null;
  init?: { type: string; body?: unknown } | null;
}

/**
 * A module-scope statement, carrying the fields `one-component-per-file` reads
 * and no others, so a fixture cannot satisfy the rule by a field it ignores.
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

const exported = (declaration: StatementFixture): StatementFixture => ({
  declaration,
  type: "ExportNamedDeclaration",
});

const functionDeclaration = (name: string) => ({
  id: { name },
  type: "FunctionDeclaration",
});

const arrowDeclarator = (name: string) => ({
  id: { name, type: "Identifier" },
  init: { type: "ArrowFunctionExpression" },
});

const arrowDeclaration = (name: string) => ({
  declarations: [arrowDeclarator(name)],
  type: "VariableDeclaration",
});

const importNode = (specifier: ImportSource, importedNames: string[] = []) => ({
  source: { value: specifier },
  specifiers: importedNames.map((name) => ({
    imported: { name, type: "Identifier" },
    type: "ImportSpecifier",
  })),
});

// The callee fixtures reach only as deep as the rules under test read, so an
// `it.skip.each` chain is a MemberExpression whose object is another one.
interface CalleeNode {
  type: string;
  name?: string;
  object?: CalleeNode;
  property?: { name: string };
  callee?: CalleeNode;
  tag?: CalleeNode;
}

const memberCallee = (
  object: CalleeNode,
  propertyName: string
): CalleeNode => ({
  object,
  property: { name: propertyName },
  type: "MemberExpression",
});

const identifier = (name: string): CalleeNode => ({
  name,
  type: "Identifier",
});

const arrowBody = { type: "ArrowFunctionExpression" };

const expectCall = {
  arguments: [],
  callee: identifier("expect"),
  type: "CallExpression",
};

const caseCall = (name: string, callee: CalleeNode) => ({
  arguments: [{ type: "Literal", value: name }, arrowBody],
  callee,
  type: "CallExpression",
});

// `it.each(table)(name, fn)` and `` it.each`table`(name, fn) `` hang the row's
// name and callback off an outer call, so the chain sits inside that call.
const callWrapper = (chain: CalleeNode): CalleeNode => ({
  callee: chain,
  type: "CallExpression",
});

const taggedWrapper = (chain: CalleeNode): CalleeNode => ({
  tag: chain,
  type: "TaggedTemplateExpression",
});

const eachChain = (base: string) => memberCallee(identifier(base), "each");

const eachRowCall = (name: string) =>
  caseCall(name, callWrapper(eachChain("it")));

describe("no-size-props", () => {
  const rule = plugin.rules["no-size-props"];

  it("should report when width prop is on a custom component with uppercase JSXIdentifier", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "width" },
      parent: {
        name: { name: "Card", type: "JSXIdentifier" },
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
        name: { name: "Avatar", type: "JSXIdentifier" },
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
          object: { name: "Icons" },
          property: { name: "Arrow" },
          type: "JSXMemberExpression",
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
          object: { name: "UI" },
          property: { name: "Box" },
          type: "JSXMemberExpression",
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
        name: { name: "img", type: "JSXIdentifier" },
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
        name: { name: "div", type: "JSXIdentifier" },
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
        name: { name: "Card", type: "JSXIdentifier" },
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

  it("should not report when the only component is declared via FunctionDeclaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(exported(functionDeclaration("MyComponent")));

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report on the second component when both are declared via FunctionDeclaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(
      exported(functionDeclaration("ComponentA")),
      exported(functionDeclaration("ComponentB"))
    );

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when the second component is declared without export", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(
      arrowDeclaration("SubmitLabel"),
      exported(arrowDeclaration("ProfileForm"))
    );

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should name both components when it reports the second one", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(
      arrowDeclaration("HomeComponent"),
      exported(arrowDeclaration("Route"))
    );

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report.mock.calls[0]?.[0].message).toBe(
      "A file declares one component, exported or not. 'Route' shares this file with 'HomeComponent'. Move it to a file named after it."
    );
  });

  it("should not report when the only component is declared via ArrowFunctionExpression", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(exported(arrowDeclaration("MyComponent")));

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report on the second component when both are declared via ArrowFunctionExpression", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(
      exported(arrowDeclaration("ComponentA")),
      exported(arrowDeclaration("ComponentB"))
    );

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report twice when a third component shares the file", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(
      arrowDeclaration("ComponentA"),
      arrowDeclaration("ComponentB"),
      exported(arrowDeclaration("ComponentC"))
    );

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).toHaveBeenCalledTimes(2);
  });

  it("should report once when one statement declares two components", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declarations: [
        arrowDeclarator("ComponentA"),
        arrowDeclarator("ComponentB"),
      ],
      type: "VariableDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a declaration has a lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(
      exported(functionDeclaration("MyComponent")),
      exported(functionDeclaration("helperFn"))
    );

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a second declaration is a hook starting with use", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(
      exported(arrowDeclaration("MyComponent")),
      exported(arrowDeclaration("useMyHook"))
    );

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named arrow sits inside the only component", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const inner = arrowDeclaration("Inner");
    const program = moduleBody({
      declaration: {
        declarations: [
          {
            id: { name: "Outer", type: "Identifier" },
            init: { body: moduleBody(inner), type: "ArrowFunctionExpression" },
          },
        ],
        type: "VariableDeclaration",
      },
      type: "ExportNamedDeclaration",
    });

    // Act
    visitors.Program(program);

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
      arguments: [{ type: "Literal", value: "renders the component" }],
      callee: { name: "it", type: "Identifier" },
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
      arguments: [{ type: "Literal", value: "returns the correct value" }],
      callee: { name: "test", type: "Identifier" },
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
      arguments: [
        { type: "Literal", value: "should return true when input is valid" },
      ],
      callee: { name: "it", type: "Identifier" },
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
      arguments: [
        {
          type: "Literal",
          value: "should render correctly when props are provided",
        },
      ],
      callee: { name: "test", type: "Identifier" },
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
      arguments: [{ type: "Literal", value: "MyComponent" }],
      callee: { name: "describe", type: "Identifier" },
    };

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when an it.each row name does not follow should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = eachRowCall("bad name");

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when an it.each row name follows the should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = eachRowCall("should reject the key when %s");

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when an it.each row name opens with a placeholder", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = eachRowCall("$label");

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a plain it() name opens with a placeholder", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = caseCall("$label", identifier("it"));

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each([
    ["test.each(table)(...)", callWrapper(eachChain("test"))],
    ["it.for(table)(...)", callWrapper(memberCallee(identifier("it"), "for"))],
    ["it.each`table`(...)", taggedWrapper(eachChain("it"))],
    [
      "it.only.each(table)(...)",
      callWrapper(memberCallee(memberCallee(identifier("it"), "only"), "each")),
    ],
  ])(
    "should report when a bad row name is declared under %s",
    (_label, callee) => {
      // Arrange
      const context = makeContext();
      const visitors = rule.create(context);
      const node = caseCall("bad name", callee);

      // Act
      visitors.CallExpression(node);

      // Assert
      expect(context.report).toHaveBeenCalledOnce();
    }
  );

  it.each([
    [
      "it.skip.each(table)(...)",
      callWrapper(memberCallee(memberCallee(identifier("it"), "skip"), "each")),
    ],
    ["describe.each(table)(...)", callWrapper(eachChain("describe"))],
    ["a factory call result", callWrapper(identifier("makeIt"))],
    [
      "a non-table it.only(table) result",
      callWrapper(memberCallee(identifier("it"), "only")),
    ],
  ])(
    "should not report when a bad row name is declared under %s",
    (_label, callee) => {
      // Arrange
      const context = makeContext();
      const visitors = rule.create(context);
      const node = caseCall("bad name", callee);

      // Act
      visitors.CallExpression(node);

      // Assert
      expect(context.report).not.toHaveBeenCalled();
    }
  );

  it("should report when a chained it.concurrent.only name does not follow should...when... format", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = caseCall(
      "bad name",
      memberCallee(memberCallee(identifier("it"), "concurrent"), "only")
    );

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when callee is it.skip", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = caseCall("bad name", memberCallee(identifier("it"), "skip"));

    // Act
    visitors.CallExpression(node);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when callee is it.todo", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const node = caseCall("bad name", memberCallee(identifier("it"), "todo"));

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
      arguments: [{ type: "Literal", value: "bad name" }],
      callee: {
        object: { name: "it", type: "Identifier" },
        property: { name: "only" },
        type: "MemberExpression",
      },
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
      arguments: [{ type: "Literal", value: "bad name" }],
      callee: {
        object: { name: "test", type: "Identifier" },
        property: { name: "only" },
        type: "MemberExpression",
      },
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

  it("should report when component name does not match file name", () => {
    const context = {
      ...makeContext(),
      filename: "/src/shared/components/StatsCard/StatsCard.tsx",
    };
    const visitors = rule.create(context);
    const node = {
      declaration: { id: { name: "UserCard" }, type: "FunctionDeclaration" },
    };

    visitors.ExportNamedDeclaration?.(node);

    expect(context.report).toHaveBeenCalledOnce();
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

describe("single-expect", () => {
  const rule = plugin.rules["single-expect"];

  it("should not report when test has exactly one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const itNode = {
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
      callee: { name: "it", type: "Identifier" },
      type: "CallExpression",
    };

    // Act
    visitors.CallExpression(itNode);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](itNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when test has more than one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const itNode = {
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
      callee: { name: "it", type: "Identifier" },
      type: "CallExpression",
    };

    // Act
    visitors.CallExpression(itNode);
    visitors.CallExpression(expectCall);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](itNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when test() block has more than one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const testNode = {
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
      callee: { name: "test", type: "Identifier" },
      type: "CallExpression",
    };

    // Act
    visitors.CallExpression(testNode);
    visitors.CallExpression(expectCall);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an it.each row has more than one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const rowNode = eachRowCall("should do X when Y");
    const tableNode = {
      arguments: [{ type: "ArrayExpression" }],
      callee: rowNode.callee.callee,
      type: "CallExpression",
    };

    // Act
    visitors.CallExpression(rowNode);
    visitors.CallExpression(tableNode);
    visitors["CallExpression:exit"](tableNode);
    visitors.CallExpression(expectCall);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](rowNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when an it.each row has exactly one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const rowNode = eachRowCall("should do X when Y");

    // Act
    visitors.CallExpression(rowNode);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](rowNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should still report when the expect calls exit before the test does", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const rowNode = eachRowCall("should do X when Y");

    // Act
    visitors.CallExpression(rowNode);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](expectCall);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](expectCall);
    visitors["CallExpression:exit"](rowNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when it.skip.each is used", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const rowNode = caseCall(
      "should do X when Y",
      callWrapper(memberCallee(memberCallee(identifier("it"), "skip"), "each"))
    );

    // Act
    visitors.CallExpression(rowNode);
    visitors.CallExpression(expectCall);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](rowNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when it.only() has more than one expect", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const onlyNode = {
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
      callee: {
        object: { name: "it", type: "Identifier" },
        property: { name: "only" },
        type: "MemberExpression",
      },
      type: "CallExpression",
    };

    // Act
    visitors.CallExpression(onlyNode);
    visitors.CallExpression(expectCall);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](onlyNode);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when it.skip() is used", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const skipNode = {
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
      callee: {
        object: { name: "it", type: "Identifier" },
        property: { name: "skip" },
        type: "MemberExpression",
      },
      type: "CallExpression",
    };

    // Act
    visitors.CallExpression(skipNode);
    visitors.CallExpression(expectCall);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](skipNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when test.todo() is used", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const todoNode = {
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "ArrowFunctionExpression" },
      ],
      callee: {
        object: { name: "test", type: "Identifier" },
        property: { name: "todo" },
        type: "MemberExpression",
      },
      type: "CallExpression",
    };

    // Act
    visitors.CallExpression(todoNode);
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](todoNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("layer-boundaries", () => {
  const rule = plugin.rules["layer-boundaries"];

  it("should not report when a route imports a gateway via alias", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/_authed/profile/route.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/user/read.fn"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
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

  it("should report when a route imports the session adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports a module inside the session directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session/caller"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports Cloudflare bindings directly", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/cloudflare/env"));

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

  it.each([
    "/repo/src/shared/components/header/header.tsx",
    "/repo/src/routes/login/-components/sign-in-button.tsx",
    "/repo/src/shared/ui/button.tsx",
  ])(
    "should report when the component at %s imports drizzle infrastructure",
    (filename) => {
      // Arrange
      const context = makeLayerContext(filename);
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode("@/lib/drizzle/db"));

      // Assert
      expect(context.report).toHaveBeenCalledOnce();
    }
  );

  it("should report when a component imports Cloudflare Workers directly", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/components/header/header.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("cloudflare:workers"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a component imports an entity", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/_authed/profile/-components/profile-page.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/entities/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it.each(["@/lib/auth/better-auth", "@/lib/auth/sign-in"])(
    "should allow the auth adapter %s when a route imports it",
    (specifier) => {
      // Arrange
      const context = makeLayerContext("/repo/src/routes/login/route.tsx");
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).not.toHaveBeenCalled();
    }
  );

  it.each([
    "@/lib/auth/session",
    "@/lib/cloudflare/env",
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

  it.each([
    "/repo/src/shared/gateway/user/read.fn.ts",
    "/repo/src/routes/login/-gateway/read.ts",
  ])("should report when the gateway at %s imports a route", (filename) => {
    // Arrange
    const context = makeLayerContext(filename);
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/login/route"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a gateway imports a component", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/ui/button"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a gateway imports the session adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a gateway imports the Cloudflare env adapter", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/avatar/index.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/cloudflare/env"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a gateway imports an entity", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/entities/user"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a gateway imports a bare package specifier", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("effect"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it.each([
    "/repo/src/shared/entities/user/index.ts",
    "/repo/src/routes/login/-entities/plan.ts",
  ])("should report when the entity at %s imports a gateway", (filename) => {
    // Arrange
    const context = makeLayerContext(filename);
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports the routes directory itself", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports the lib directory itself", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports an adapter", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/drizzle/schema"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports a route", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/login/route"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an entity imports a component", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/entities/user/index.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/components/header"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a gateway imports a sibling gateway", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.fn.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/runtime"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it.each([
    "@/routes/login/route",
    "@/shared/gateway/user",
    "@/shared/ui/button",
  ])("should report when an adapter imports %s", (specifier) => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/storage/r2.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode(specifier));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an adapter in a ui directory imports a gateway", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/ui/thing.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/shared/gateway/user"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when an adapter imports a gateway via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/storage/r2.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../shared/gateway/runtime"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each(["@/lib/drizzle/db", "@/shared/entities/user"])(
    "should not report when an adapter imports %s",
    (specifier) => {
      // Arrange
      const context = makeLayerContext("/repo/src/lib/storage/r2.ts");
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).not.toHaveBeenCalled();
    }
  );

  it("should report when a route imports drizzle infrastructure via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../lib/drizzle/db"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports a banned specifier carrying the coverage suffix", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session.entry"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a route imports a module whose trailing segment is not a coverage suffix", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/lib/auth/session.helpers"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a route imports a banned relative specifier carrying the coverage suffix", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../lib/auth/session.entry"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a route imports another route's private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@/routes/index/-components/code-block/code-block")
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a layout route imports a nested route's private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/_authed/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@/routes/_authed/profile/-components/profile-page")
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a shared component imports a route's private directory", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/components/header/header.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(
      importNode("@/routes/login/-components/sign-in-button")
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a route imports its own private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./-components/sign-in-button"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the root route imports the private directory beside it", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/__root.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./-components/root-layout"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a nested route imports the root route's private directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/-components/not-found"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should name the root route's own level when it reports a reach into it", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("@/routes/-components/not-found"));

    // Assert
    expect(context.report.mock.calls[0]?.[0].message).toBe(
      "A `-` directory is private to the route files directly in `src/routes/`. A second route reaching this module makes it shared, so move it to `src/shared/`."
    );
  });

  it("should not report when a module in the root route's private directory imports its sibling", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/-components/root-layout.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./not-found"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a module inside a private directory imports its sibling", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/routes/_authed/profile/-components/profile-form/profile-form.tsx"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../profile-page"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a route imports a dash-prefixed file beside it", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("./-avatars.test"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a route imports a sibling route via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../index/route"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a relative path escapes the src directory", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../../tools/helper"));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when importing a bare package specifier", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
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

  it("should return no visitors when the file is not in a chain layer", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/router.tsx");

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ImportDeclaration).toBeUndefined();
  });

  it("should return no visitors when filename is unavailable", () => {
    // Arrange
    const context = makeLayerContext();

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors.ImportDeclaration).toBeUndefined();
  });

  it("should report when a banned module is re-exported via export-from", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.(importNode("@/lib/drizzle/db"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a banned module is re-exported via export-all", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportAllDeclaration?.(importNode("@/lib/drizzle/db"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when an export declaration has no source", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportNamedDeclaration?.({ source: null });

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the import source value is not a string", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
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

  it("should report when a default-exported component follows an already-declared one", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody(exported(arrowDeclaration("Card")), {
      declaration: { id: { name: "Page" }, type: "FunctionDeclaration" },
      type: "ExportDefaultDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should not report when a function declaration has no name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: { id: {}, type: "FunctionDeclaration" },
      type: "ExportNamedDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a named export has no declaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: null,
      type: "ExportNamedDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a declaration is a class", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: { id: { name: "Card" }, type: "ClassDeclaration" },
      type: "ExportNamedDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a function declaration is anonymous", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: { id: null, type: "FunctionDeclaration" },
      type: "ExportNamedDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a variable declarator uses a destructuring pattern", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declarations: [{ id: { type: "ObjectPattern" } }],
      type: "VariableDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named variable has no initializer", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declarations: [{ id: { name: "Card", type: "Identifier" }, init: null }],
      type: "VariableDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a component-named variable is initialized by a call", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declarations: [
        {
          id: { name: "Card", type: "Identifier" },
          init: { type: "CallExpression" },
        },
      ],
      type: "VariableDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export has no declaration", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: null,
      type: "ExportDefaultDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export is an arrow function", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: { type: "ArrowFunctionExpression" },
      type: "ExportDefaultDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export is an anonymous function expression", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: { id: null, type: "FunctionExpression" },
      type: "ExportDefaultDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a default export function has a lowercase name", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      declaration: { id: { name: "helper" }, type: "FunctionDeclaration" },
      type: "ExportDefaultDeclaration",
    });

    // Act
    visitors.Program(program);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a statement is neither a declaration nor an export", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const program = moduleBody({
      source: { value: "react" },
      type: "ImportDeclaration",
    });

    // Act
    visitors.Program(program);

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
      arguments: [{ type: "Literal", value: "bad name" }],
      callee: {
        object: { name: "it", type: "Identifier" },
        property: { name: "only" },
        type: "MemberExpression",
      },
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
      arguments: [{ type: "Literal", value: "bad name" }],
      callee: {
        object: { name: "it", type: "Identifier" },
        property: null,
        type: "MemberExpression",
      },
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
      arguments: [],
      callee: { name: "it", type: "Identifier" },
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
      arguments: [{ type: "TemplateLiteral" }],
      callee: { name: "it", type: "Identifier" },
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
      arguments: [{ type: "Literal", value: 42 }],
      callee: { name: "it", type: "Identifier" },
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
      arguments: [{ type: "Literal", value: "bad name" }],
      callee: {
        object: { name: "it", type: "Identifier" },
        property: { name: "skip" },
        type: "MemberExpression",
      },
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
      arguments: [{ type: "Literal", value: "bad name" }],
      callee: {
        object: { name: "foo", type: "Identifier" },
        property: { name: "only" },
        type: "MemberExpression",
      },
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
    arguments: [
      { type: "Literal", value: "should do X when Y" },
      { type: "ArrowFunctionExpression" },
    ],
    callee: { name: "it", type: "Identifier" },
    type: "CallExpression",
  };

  it("should not report when a call inside a test has no callee", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);

    // Act
    visitors.CallExpression(testNode);
    visitors.CallExpression({ callee: null, type: "CallExpression" });
    visitors.CallExpression(expectCall);
    visitors["CallExpression:exit"](testNode);

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when a member call inside a test targets a non-expect object", () => {
    // Arrange
    const context = makeContext();
    const visitors = rule.create(context);
    const memberCall = {
      callee: {
        object: { name: "foo", type: "Identifier" },
        property: { name: "bar" },
        type: "MemberExpression",
      },
      type: "CallExpression",
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
      callee: {
        object: null,
        property: { name: "x" },
        type: "MemberExpression",
      },
      type: "CallExpression",
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
      arguments: [{ type: "Literal", value: "should do X when Y" }],
      callee: { name: "it", type: "Identifier" },
      type: "CallExpression",
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
      arguments: [
        { type: "Literal", value: "should do X when Y" },
        { type: "Literal", value: "not a function" },
      ],
      callee: { name: "it", type: "Identifier" },
      type: "CallExpression",
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
      callee: { name: "helper", type: "Identifier" },
      type: "CallExpression",
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
      callee: {
        object: { name: "expect", type: "Identifier" },
        property: { name: "soft" },
        type: "MemberExpression",
      },
      type: "CallExpression",
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
});

describe("server-only-marker", () => {
  const rule = plugin.rules["server-only-marker"];

  const SERVER_ONLY = "@tanstack/react-start/server-only";

  it("should report when a gateway module opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/read.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when a gateway module carries the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/read.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when the marker arrives as a type-only import", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/shared/gateway/user/read.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(
      programNode([{ importKind: "type", value: SERVER_ONLY }])
    );

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when the module is the fn file the compiler ships to the browser", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.fn.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["@tanstack/react-start"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the module is a gateway test file", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.test.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a session module opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/session/caller.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when a session module carries the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/session/caller.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should report when a session module names a suffix only the gateway layer exempts", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/session/read.fn.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a fn file carries the marker the compiler would ship", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/read.fn.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "@tanstack/react-start"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a module directly under the auth directory opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/better-auth.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["better-auth"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when the Cloudflare env adapter opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/cloudflare/env.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["cloudflare:workers"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a sign-in module carries the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/sign-in/client.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode([SERVER_ONLY, "effect"]));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should stay silent when a sign-in module opens without the marker", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/sign-in/client.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when a sign-in module names the marker as a type-only import", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/auth/sign-in/client.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(
      programNode([{ importKind: "type", value: SERVER_ONLY }])
    );

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the module sits outside every directory the rule names", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/lib/avatar-url.ts");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(programNode(["effect"]));

    // Assert
    expect(context.report).not.toHaveBeenCalled();
  });

  it("should stay silent when the file sits outside src", () => {
    // Arrange
    const context = makeLayerContext("/repo/scripts/smoke.entry.ts");

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors).toStrictEqual({});
  });

  it("should stay silent when the linter supplies no filename", () => {
    // Arrange
    const context = makeLayerContext();

    // Act
    const visitors = rule.create(context);

    // Assert
    expect(visitors).toStrictEqual({});
  });
});
