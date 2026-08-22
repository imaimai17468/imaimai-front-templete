const noSizeProps = {
  create(context) {
    return {
      JSXAttribute(node) {
        const propName = node.name && node.name.name;
        if (propName !== "width" && propName !== "height") return;
        const openingElement = node.parent;
        if (!openingElement) return;
        const elementName = openingElement.name;
        if (elementName.type === "JSXMemberExpression") {
          context.report({
            message: `Do not pass '${propName}' prop to components. Control size externally via the parent's CSS layout.`,
            node,
          });
          return;
        }
        if (elementName.type === "JSXIdentifier") {
          const firstChar = elementName.name[0];
          if (
            firstChar === firstChar.toUpperCase() &&
            firstChar !== firstChar.toLowerCase()
          ) {
            context.report({
              message: `Do not pass '${propName}' prop to components. Control size externally via the parent's CSS layout.`,
              node,
            });
          }
        }
      },
    };
  },
};

const isComponentName = (name) =>
  typeof name === "string" &&
  name[0] === name[0].toUpperCase() &&
  name[0] !== name[0].toLowerCase();

const oneComponentPerFile = {
  create(context) {
    const exportedComponents = [];

    const reportIfSecond = (node) => {
      exportedComponents.push(node);
      if (exportedComponents.length > 1) {
        context.report({
          message:
            "Only one component may be exported per file. Found multiple exported components.",
          node,
        });
      }
    };

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (decl.type === "FunctionDeclaration") {
          if (decl.id && isComponentName(decl.id.name)) {
            reportIfSecond(node);
          }
          return;
        }
        if (decl.type === "VariableDeclaration") {
          decl.declarations.forEach((declarator) => {
            const name =
              declarator.id && declarator.id.type === "Identifier"
                ? declarator.id.name
                : null;
            if (!name || !isComponentName(name)) return;
            const init = declarator.init;
            if (
              init &&
              (init.type === "ArrowFunctionExpression" ||
                init.type === "FunctionExpression")
            ) {
              reportIfSecond(node);
            }
          });
        }
      },
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (
          (decl.type === "FunctionDeclaration" ||
            decl.type === "FunctionExpression") &&
          decl.id &&
          isComponentName(decl.id.name)
        ) {
          reportIfSecond(node);
        }
      },
    };
  },
};

const TEST_NAME_RE = /^should\s+.+\s+when\s+/i;

const SKIP_METHODS = new Set(["each", "skip", "todo"]);

const testNamingFormat = {
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        let calleeName = null;
        if (callee.type === "Identifier") {
          calleeName = callee.name;
        } else if (
          callee.type === "MemberExpression" &&
          callee.object &&
          callee.object.type === "Identifier" &&
          (callee.object.name === "it" || callee.object.name === "test")
        ) {
          if (callee.property && SKIP_METHODS.has(callee.property.name)) {
            return;
          }
          calleeName = callee.object.name;
        }
        if (calleeName !== "it" && calleeName !== "test") return;
        const firstArg = node.arguments[0];
        if (!firstArg) return;
        const testName =
          firstArg.type === "Literal" || firstArg.type === "StringLiteral"
            ? firstArg.value
            : null;
        if (typeof testName !== "string") return;
        if (!TEST_NAME_RE.test(testName)) {
          context.report({
            message: `Test name must follow the format: 'should [expected behavior] when [condition]'. Got: '${testName}'`,
            node,
          });
        }
      },
    };
  },
};

const isExpectCall = (node) => {
  const callee = node.callee;
  if (!callee) return false;
  if (callee.type === "Identifier" && callee.name === "expect") return true;
  if (
    callee.type === "MemberExpression" &&
    callee.object &&
    callee.object.name === "expect"
  )
    return true;
  return false;
};

const isEachCall = (node) => {
  const callee = node.callee;
  if (!callee) return false;
  if (
    callee.type === "MemberExpression" &&
    callee.object &&
    (callee.object.name === "it" || callee.object.name === "test") &&
    callee.property &&
    callee.property.name === "each"
  )
    return true;
  return false;
};

const singleExpect = {
  create(context) {
    const scopeStack = [];

    return {
      CallExpression(node) {
        if (isEachCall(node)) return;
        const callee = node.callee;
        let calleeName =
          callee && callee.type === "Identifier" ? callee.name : null;
        if (
          calleeName === null &&
          callee &&
          callee.type === "MemberExpression" &&
          callee.object &&
          callee.object.type === "Identifier" &&
          (callee.object.name === "it" || callee.object.name === "test")
        ) {
          if (callee.property && SKIP_METHODS.has(callee.property.name)) {
            return;
          }
          calleeName = callee.object.name;
        }
        if (calleeName === "it" || calleeName === "test") {
          const secondArg = node.arguments[1];
          if (
            secondArg &&
            (secondArg.type === "ArrowFunctionExpression" ||
              secondArg.type === "FunctionExpression")
          ) {
            scopeStack.push({ testNode: node, count: 0 });
          }
          return;
        }
        if (scopeStack.length > 0 && isExpectCall(node)) {
          const current = scopeStack[scopeStack.length - 1];
          current.count += 1;
        }
      },
      "CallExpression:exit"(node) {
        if (isEachCall(node)) return;
        const callee = node.callee;
        let calleeName =
          callee && callee.type === "Identifier" ? callee.name : null;
        if (
          calleeName === null &&
          callee &&
          callee.type === "MemberExpression" &&
          callee.object &&
          callee.object.type === "Identifier" &&
          (callee.object.name === "it" || callee.object.name === "test")
        ) {
          if (callee.property && SKIP_METHODS.has(callee.property.name)) {
            return;
          }
          calleeName = callee.object.name;
        }
        if (calleeName !== "it" && calleeName !== "test") return;
        const secondArg = node.arguments[1];
        if (
          !secondArg ||
          (secondArg.type !== "ArrowFunctionExpression" &&
            secondArg.type !== "FunctionExpression")
        )
          return;
        if (scopeStack.length === 0) return;
        const scope = scopeStack.pop();
        if (scope.count > 1) {
          context.report({
            message: `Each test case should have exactly one expect(). Found ${scope.count} expect() calls.`,
            node: scope.testNode,
          });
        }
      },
    };
  },
};

const SKIP_STEMS = new Set(["index"]);

const componentFileNaming = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    if (!filename) return {};

    const basename = filename.slice(filename.lastIndexOf("/") + 1);
    const withoutExt = basename.replace(/\.(tsx?|jsx?)$/, "");

    if (
      withoutExt === "" ||
      SKIP_STEMS.has(withoutExt) ||
      withoutExt.endsWith(".test") ||
      withoutExt.endsWith(".spec")
    )
      return {};

    const expectedName = withoutExt
      .split(".")
      .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
      .join("");

    if (!isComponentName(expectedName)) return {};

    const checkComponentName = (name, node) => {
      if (name && isComponentName(name) && name !== expectedName) {
        context.report({
          message: `Component name '${name}' does not match file name. Expected '${expectedName}'.`,
          node,
        });
      }
    };

    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (decl.type === "FunctionDeclaration" && decl.id) {
          checkComponentName(decl.id.name, node);
          return;
        }
        if (decl.type === "VariableDeclaration") {
          decl.declarations.forEach((declarator) => {
            const name =
              declarator.id && declarator.id.type === "Identifier"
                ? declarator.id.name
                : null;
            if (!name || !isComponentName(name)) return;
            const init = declarator.init;
            if (
              init &&
              (init.type === "ArrowFunctionExpression" ||
                init.type === "FunctionExpression")
            ) {
              checkComponentName(name, node);
            }
          });
        }
      },
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;
        if (
          (decl.type === "FunctionDeclaration" ||
            decl.type === "FunctionExpression") &&
          decl.id
        ) {
          checkComponentName(decl.id.name, node);
        }
      },
    };
  },
};

// Layer contract: components + routes → client → server/router → gateways → entities,
// imports flow downward only. `client` is the UI's single door to data access, so
// components reach the server boundary through it and never past it. `lib` outside
// the binding-touching modules stays unrestricted; the banned ones are listed per
// layer below rather than counted here.
const LAYER_BANS = [
  {
    layer: "src/components",
    externalBans: [
      {
        source: "cloudflare:workers",
        message:
          "Components must not access Cloudflare bindings — data access belongs in src/client.",
      },
      {
        source: "@tanstack/react-start/server",
        message:
          "Components must not resolve server request context — data access belongs in src/client.",
      },
    ],
    bans: [
      {
        target: "src/server",
        message:
          "Components must not call server procedures directly — go through src/client.",
      },
      {
        target: "src/gateways",
        message: "Components must not import gateways — go through src/client.",
      },
      {
        target: "src/lib/drizzle",
        message:
          "Components must not touch persistence — src/lib/drizzle is owned by gateways.",
      },
      {
        target: "src/lib/storage/r2",
        message:
          "Components must not touch object storage — src/lib/storage/r2 is owned by gateways.",
      },
      {
        target: "src/lib/auth/session",
        message:
          "Components must not resolve request authentication — go through src/client.",
      },
      {
        target: "src/lib/auth/auth",
        message:
          "Components must not touch the raw Better Auth instance — src/lib/auth/auth reaches persistence and Cloudflare bindings directly; go through src/client.",
      },
    ],
  },
  {
    layer: "src/client",
    externalBans: [
      {
        source: "cloudflare:workers",
        message:
          "src/client also runs in the browser — it must not access Cloudflare bindings.",
      },
      {
        source: "@tanstack/react-start/server",
        message:
          "src/client also runs in the browser — it must not resolve server request context.",
      },
    ],
    bans: [
      {
        target: "src/gateways",
        message:
          "src/client must not import gateways — cross the boundary through a server procedure.",
      },
      {
        target: "src/lib/drizzle",
        message:
          "src/client must not touch persistence — src/lib/drizzle is owned by gateways.",
      },
      {
        target: "src/lib/storage/r2",
        message:
          "src/client must not touch object storage — src/lib/storage/r2 is owned by gateways.",
      },
      {
        target: "src/lib/auth/session",
        message:
          "src/client must not resolve request authentication — that is the server boundary's job.",
      },
      {
        target: "src/lib/auth/auth",
        message:
          "src/client must not touch the raw Better Auth instance — src/lib/auth/auth reaches persistence and Cloudflare bindings directly.",
      },
    ],
  },
  {
    layer: "src/routes",
    externalBans: [
      {
        source: "cloudflare:workers",
        message:
          "Routes must not access Cloudflare bindings directly — delegate through src/server/router to a gateway.",
      },
      {
        source: "@tanstack/react-start/server",
        message:
          "Routes must not resolve request context directly — delegate to src/server/router.",
      },
    ],
    bans: [
      {
        target: "src/gateways",
        message:
          "Routes must not import gateways directly — go through a procedure in src/server/router.",
      },
      {
        target: "src/lib/drizzle",
        message:
          "Routes must not touch persistence — src/lib/drizzle is owned by gateways.",
      },
      {
        target: "src/lib/auth/session",
        message:
          "Routes must not resolve request authentication — delegate to src/server/router.",
      },
      {
        target: "src/server/cloudflare",
        message:
          "Routes must not access Cloudflare persistence bindings directly — delegate through src/server/router to a gateway.",
      },
      {
        target: "src/server/router",
        message:
          "Routes must not call server procedures — a browser-facing route reaches data through src/client, and an HTTP endpoint belongs in the Hono app at src/server/app.",
      },
      {
        target: "src/server/handlers",
        message:
          "Routes must not call HTTP handlers directly — register them on the Hono app at src/server/app.",
      },
    ],
  },
  {
    layer: "src/server/router",
    bans: [
      {
        target: "src/routes",
        message:
          "Procedures must not import routes — imports flow downward only.",
      },
    ],
  },
  {
    layer: "src/gateways",
    bans: [
      {
        target: "src/routes",
        message:
          "Gateways must not import routes — imports flow downward only.",
      },
      {
        target: "src/server/router",
        message:
          "Gateways must not import procedures — imports flow downward only.",
      },
      {
        target: "src/components",
        message: "Gateways never import components.",
      },
      {
        target: "src/lib/auth",
        message:
          "Gateways must not resolve request authentication — derive identity in src/server/router and pass it downward.",
      },
    ],
  },
  {
    layer: "src/entities",
    bans: [
      {
        target: "src/routes",
        message:
          "Entities import nothing from the layers above — routes are above entities.",
      },
      {
        target: "src/server/router",
        message:
          "Entities import nothing from the layers above — procedures are above entities.",
      },
      {
        target: "src/gateways",
        message:
          "Entities import nothing from the layers above — gateways are above entities.",
      },
    ],
  },
];

const SRC_MARKER = "/src/";

const resolveImportTarget = (fileSrcDir, specifier) => {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith(".")) {
    const parts = fileSrcDir.split("/");
    specifier.split("/").forEach((segment) => {
      if (segment === ".") return;
      if (segment === "..") parts.pop();
      else parts.push(segment);
    });
    return parts.join("/");
  }
  return null;
};

const layerBoundaries = {
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    if (!filename) return {};

    const srcIndex = filename.lastIndexOf(SRC_MARKER);
    if (srcIndex === -1) return {};
    const srcPath = filename.slice(srcIndex + 1);
    const fileSrcDir = srcPath.slice(0, srcPath.lastIndexOf("/"));

    const layerEntry = LAYER_BANS.find((entry) =>
      srcPath.startsWith(`${entry.layer}/`)
    );
    if (!layerEntry) return {};

    const checkImportSource = (node) => {
      const source = node.source;
      if (!source || typeof source.value !== "string") return;
      const externalViolation = layerEntry.externalBans?.find(
        (ban) => source.value === ban.source
      );
      if (externalViolation !== undefined) {
        context.report({ message: externalViolation.message, node });
        return;
      }
      const target = resolveImportTarget(fileSrcDir, source.value);
      if (target === null) return;
      const violated = layerEntry.bans.find(
        (ban) => target === ban.target || target.startsWith(`${ban.target}/`)
      );
      if (violated !== undefined) {
        context.report({ message: violated.message, node });
      }
    };

    return {
      ImportDeclaration: checkImportSource,
      ImportExpression: checkImportSource,
      ExportNamedDeclaration: checkImportSource,
      ExportAllDeclaration: checkImportSource,
    };
  },
};

const plugin = {
  meta: { name: "arch-rules" },
  rules: {
    "no-size-props": noSizeProps,
    "one-component-per-file": oneComponentPerFile,
    "component-file-naming": componentFileNaming,
    "test-naming-format": testNamingFormat,
    "single-expect": singleExpect,
    "layer-boundaries": layerBoundaries,
  },
};

export default plugin;
