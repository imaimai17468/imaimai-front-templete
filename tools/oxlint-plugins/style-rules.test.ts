import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vite-plus/test";
import plugin from "./style-rules.js";

const createMockContext = () => ({
  report: vi.fn<(descriptor: { message: string; node: unknown }) => void>(),
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
    expression: {
      quasis: [{ value: { raw } }],
      type: "TemplateLiteral" as const,
    },
    type: "JSXExpressionContainer" as const,
  },
});

const makeClassNameExpressionLiteralNode = (value: string) => ({
  name: { name: "className" },
  value: {
    expression: {
      type: "Literal" as const,
      value,
    },
    type: "JSXExpressionContainer" as const,
  },
});

const makeClassNameExpressionStringLiteralNode = (value: string) => ({
  name: { name: "className" },
  value: {
    expression: {
      type: "StringLiteral" as const,
      value,
    },
    type: "JSXExpressionContainer" as const,
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

describe("no-tailwind-arbitrary (defensive branches)", () => {
  const rule = plugin.rules["no-tailwind-arbitrary"];

  it("should not report when the className attribute has no value", () => {
    const context = createMockContext();
    const visitors = rule.create(context);

    visitors.JSXAttribute({ name: { name: "className" }, value: null });

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the className expression is a function call", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      value: {
        expression: { type: "CallExpression" },
        type: "JSXExpressionContainer",
      },
    };

    visitors.JSXAttribute(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the className expression is a numeric literal", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      value: {
        expression: { type: "Literal", value: 42 },
        type: "JSXExpressionContainer",
      },
    };

    visitors.JSXAttribute(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the className value is an unknown node type", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      value: { type: "JSXElement" },
    };

    visitors.JSXAttribute(node);

    expect(context.report).not.toHaveBeenCalled();
  });
});

describe("no-tailwind-opacity (defensive branches)", () => {
  const rule = plugin.rules["no-tailwind-opacity"];

  it("should not report when the className attribute has no value", () => {
    const context = createMockContext();
    const visitors = rule.create(context);

    visitors.JSXAttribute({ name: { name: "className" }, value: null });

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the className expression is a function call", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      value: {
        expression: { type: "CallExpression" },
        type: "JSXExpressionContainer",
      },
    };

    visitors.JSXAttribute(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the className expression is a numeric literal", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      value: {
        expression: { type: "Literal", value: 42 },
        type: "JSXExpressionContainer",
      },
    };

    visitors.JSXAttribute(node);

    expect(context.report).not.toHaveBeenCalled();
  });

  it("should not report when the className value is an unknown node type", () => {
    const context = createMockContext();
    const visitors = rule.create(context);
    const node = {
      name: { name: "className" },
      value: { type: "JSXElement" },
    };

    visitors.JSXAttribute(node);

    expect(context.report).not.toHaveBeenCalled();
  });
});

describe.each([
  {
    allowed: "bg-primary text-muted-foreground border-border",
    flagged: "bg-red-500 text-white",
    matches: ["bg-red-500", "text-white"],
    rule: "no-tailwind-palette-color",
  },
  {
    allowed: "shadow-none shadow-lifted",
    flagged: "shadow drop-shadow-md shadow-inner",
    matches: ["shadow", "drop-shadow-md", "shadow-inner"],
    rule: "no-tailwind-shadow",
  },
  {
    allowed: "mx-auto -mx-2 my-auto gap-2",
    flagged: "mr-2 mt-0.5 space-y-4 m-px",
    matches: ["mr-2", "mt-0.5", "space-y-4", "m-px"],
    rule: "no-tailwind-sibling-margin",
  },
  {
    allowed: "transition-transform transition-colors",
    flagged: "transition-all",
    matches: ["transition-all"],
    rule: "no-tailwind-transition-all",
  },
  {
    allowed: "ease-out ease-in-out",
    flagged: "ease-in",
    matches: ["ease-in"],
    rule: "no-tailwind-ease-in",
  },
] as const)("$rule", ({ allowed, flagged, matches, rule }) => {
  const visitors = () => {
    const context = createMockContext();
    return { context, visitors: plugin.rules[rule].create(context) };
  };

  it("should report each forbidden class when className holds them", () => {
    const { context, visitors: v } = visitors();

    v.JSXAttribute(makeClassNameNode(flagged));

    expect(
      context.report.mock.calls.map(([call]) =>
        matches.some((match) => call.message.includes(`'${match}'`))
      )
    ).toStrictEqual(matches.map(() => true));
  });

  it("should not report when className holds only allowed classes", () => {
    const { context, visitors: v } = visitors();

    v.JSXAttribute(makeClassNameNode(allowed));

    expect(context.report).not.toHaveBeenCalled();
  });
});

const importFrom = (source: string, local: string) => ({
  source: { value: source },
  specifiers: [{ local: { name: local } }],
});

const element = (
  name: { name: string; type: string },
  attributes: readonly unknown[]
) => ({ attributes, name });

describe("no-restyle-shared-ui-at-call-site", () => {
  const rule = plugin.rules["no-restyle-shared-ui-at-call-site"];

  const run = (
    source: string,
    name: { name: string; type: string },
    attributes: readonly unknown[]
  ) => {
    const context = createMockContext();
    const visitors = rule.create(context);
    visitors.ImportDeclaration(importFrom(source, "Button"));
    visitors.JSXOpeningElement(element(name, attributes));
    return context.report.mock.calls.map(([call]) => call.message);
  };

  const BUTTON = { name: "Button", type: "JSXIdentifier" };

  it("should report each appearance class when a shared/ui primitive receives them", () => {
    const messages = run("@/shared/ui/button", BUTTON, [
      {
        ...makeClassNameNode("w-full hover:bg-muted rounded-lg"),
        type: "JSXAttribute",
      },
    ]);

    expect(messages).toStrictEqual([
      "'hover:bg-muted' restyles <Button> at its call site. Add a variant to the primitive in src/shared/ui/ and pass the variant; a call site passes only placement classes such as width or grid position.",
      "'rounded-lg' restyles <Button> at its call site. Add a variant to the primitive in src/shared/ui/ and pass the variant; a call site passes only placement classes such as width or grid position.",
    ]);
  });

  it.each([
    {
      attributes: [
        {
          ...makeClassNameNode("w-full col-span-2 mx-auto"),
          type: "JSXAttribute",
        },
      ],
      name: BUTTON,
      scenario: "the primitive receives only placement classes",
      source: "@/shared/ui/button",
    },
    {
      attributes: [{ ...makeClassNameNode("bg-muted"), type: "JSXAttribute" }],
      name: BUTTON,
      scenario: "the component is imported from outside shared/ui",
      source: "@/shared/components/button",
    },
    {
      attributes: [{ ...makeClassNameNode("bg-muted"), type: "JSXAttribute" }],
      name: { name: "Card", type: "JSXIdentifier" },
      scenario: "the element is not an imported primitive",
      source: "@/shared/ui/button",
    },
    {
      attributes: [{ ...makeClassNameNode("bg-muted"), type: "JSXAttribute" }],
      name: { name: "Button.Root", type: "JSXMemberExpression" },
      scenario: "the element name is a member expression",
      source: "@/shared/ui/button",
    },
    {
      attributes: [{ argument: {}, type: "JSXSpreadAttribute" }],
      name: BUTTON,
      scenario: "the only attribute is a spread",
      source: "@/shared/ui/button",
    },
  ])("should not report when $scenario", ({ attributes, name, source }) => {
    const messages = run(source, name, attributes);

    expect(messages).toStrictEqual([]);
  });
});

describe("no-tailwind-palette-color against the pinned Tailwind", () => {
  const themeCss = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../node_modules/tailwindcss/theme.css"
    ),
    "utf-8"
  );
  const palettes = [...themeCss.matchAll(/--color-(?<name>[a-z]+)-500:/gu)].map(
    (match) => match.groups?.name ?? ""
  );

  it("should report bg-<name>-500 when name is any palette the installed theme defines", () => {
    const context = createMockContext();
    const visitors = plugin.rules["no-tailwind-palette-color"].create(context);

    visitors.JSXAttribute(
      makeClassNameNode(palettes.map((name) => `bg-${name}-500`).join(" "))
    );

    expect(context.report).toHaveBeenCalledTimes(palettes.length);
  });
});
