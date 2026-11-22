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

const importNode = (specifier: ImportSource, importedNames: string[] = []) => ({
  source: { value: specifier },
  specifiers: importedNames.map((name) => ({
    imported: { name, type: "Identifier" },
    type: "ImportSpecifier",
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

describe("route-imports-its-component", () => {
  const rule = plugin.rules["route-imports-its-component"];

  it("should report when a route file declares the component it draws", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/index/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(moduleBody(arrowDeclaration("HomeComponent")));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should name the component and its destination when it reports a route file", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/index/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.Program?.(moduleBody(arrowDeclaration("HomeComponent")));

    // Assert
    expect(context.report.mock.calls[0]?.[0].message).toBe(
      "A route file declares 'Route' and imports what it draws. Move 'HomeComponent' to a '-components/' directory beside this file and import it."
    );
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

  it.each(["void/db", "void/storage", "void/env", "@schema", "@schema/users"])(
    "should report when a route imports %s",
    (specifier) => {
      // Arrange
      const context = makeLayerContext("/repo/src/routes/api/avatars.ts");
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).toHaveBeenCalledOnce();
    }
  );

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
    "should report when the component at %s imports the database client",
    (filename) => {
      // Arrange
      const context = makeLayerContext(filename);
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode("void/db"));

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
    "void/storage",
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

  it("should not report when a gateway imports the storage client", () => {
    // Arrange
    const context = makeLayerContext(
      "/repo/src/shared/gateway/user/avatar/index.ts"
    );
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("void/storage"));

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
    visitors.ImportDeclaration?.(importNode("@/lib/utils"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it.each(["void/db", "void/storage", "void/env", "@schema"])(
    "should report when an entity imports %s",
    (specifier) => {
      // Arrange
      const context = makeLayerContext(
        "/repo/src/shared/entities/user/index.ts"
      );
      const visitors = rule.create(context);

      // Act
      visitors.ImportDeclaration?.(importNode(specifier));

      // Assert
      expect(context.report).toHaveBeenCalledOnce();
    }
  );

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

  it.each(["@/lib/memoize-value", "@/shared/entities/user"])(
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

  it("should report when a route imports the session adapter via relative path", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ImportDeclaration?.(importNode("../../lib/auth/session"));

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
    visitors.ExportNamedDeclaration?.(importNode("void/db"));

    // Assert
    expect(context.report).toHaveBeenCalledOnce();
  });

  it("should report when a banned module is re-exported via export-all", () => {
    // Arrange
    const context = makeLayerContext("/repo/src/routes/login/route.tsx");
    const visitors = rule.create(context);

    // Act
    visitors.ExportAllDeclaration?.(importNode("@/lib/auth/session"));

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
    const context = makeLayerContext("/repo/scripts/smoke/smoke.entry.ts");

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

interface MockArgumentFixture {
  type: string;
  value?: string | number;
  source?: MockArgumentFixture;
}

/** A call node carrying the fields `no-app-module-mock` reads. */
interface MockCallFixture {
  arguments: MockArgumentFixture[];
  callee: {
    type: string;
    name?: string;
    object?: { name: string; type: string };
    property?: { name: string; type: string };
  };
  type: string;
}

const literal = (value: string | number): MockArgumentFixture => ({
  type: "Literal",
  value,
});

const viCall = (
  method: string,
  args: MockArgumentFixture[]
): MockCallFixture => ({
  arguments: args,
  callee: {
    object: { name: "vi", type: "Identifier" },
    property: { name: method, type: "Identifier" },
    type: "MemberExpression",
  },
  type: "CallExpression",
});

describe("no-app-module-mock", () => {
  const rule = plugin.rules["no-app-module-mock"];

  const reportCount = (node: MockCallFixture) => {
    const context = makeContext();
    rule.create(context).CallExpression(node);
    return context.report.mock.calls.length;
  };

  it.each([
    { args: [literal("./client")], method: "mock", name: "a relative path" },
    { args: [literal("../client")], method: "mock", name: "a parent path" },
    { args: [literal("@/lib/auth")], method: "doMock", name: "an alias path" },
    {
      args: [{ source: literal("./client"), type: "ImportExpression" }],
      method: "mock",
      name: "an import() of a relative path",
    },
  ])("should report when vi.$method names $name", ({ args, method }) => {
    expect(reportCount(viCall(method, args))).toBe(1);
  });

  it.each([
    { args: [literal("react-grab")], method: "mock", name: "a package" },
    { args: [literal("./client")], method: "spyOn", name: "a spy" },
    { args: [], method: "mock", name: "no argument" },
    { args: [literal(1)], method: "mock", name: "a non-string literal" },
    {
      args: [{ type: "TemplateLiteral" }],
      method: "mock",
      name: "a non-literal",
    },
  ])("should not report when the call is $name", ({ args, method }) => {
    expect(reportCount(viCall(method, args))).toBe(0);
  });

  it("should not report when the callee is not a member of vi", () => {
    expect(
      reportCount({
        arguments: [literal("./client")],
        callee: {
          object: { name: "jest", type: "Identifier" },
          property: { name: "mock", type: "Identifier" },
          type: "MemberExpression",
        },
        type: "CallExpression",
      })
    ).toBe(0);
  });

  it("should not report when the callee is a plain function", () => {
    expect(
      reportCount({
        arguments: [literal("./client")],
        callee: { name: "mock", type: "Identifier" },
        type: "CallExpression",
      })
    ).toBe(0);
  });
});
