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
      SKIP_STEMS.has(withoutExt) ||
      withoutExt.endsWith(".test") ||
      withoutExt.endsWith(".spec")
    )
      return {};

    const expectedName = withoutExt
      .split(".")
      .map((s) => s[0].toUpperCase() + s.slice(1))
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

// Layer contract from ADR-0016: routes → server/fn → gateways → entities,
// imports flow downward only. Only the bans the ADR states are encoded here —
// side categories (components, lib outside drizzle) stay unrestricted.
const LAYER_BANS = [
  {
    layer: "src/routes",
    bans: [
      {
        target: "src/gateways",
        message:
          "Routes must not import gateways directly — go through a server function in src/server/fn (ADR-0016).",
      },
      {
        target: "src/lib/drizzle",
        message:
          "Routes must not touch persistence — src/lib/drizzle is owned by gateways (ADR-0016).",
      },
    ],
  },
  {
    layer: "src/server/fn",
    bans: [
      {
        target: "src/routes",
        message:
          "Server functions must not import routes — imports flow downward only (ADR-0016).",
      },
    ],
  },
  {
    layer: "src/gateways",
    bans: [
      {
        target: "src/routes",
        message:
          "Gateways must not import routes — imports flow downward only (ADR-0016).",
      },
      {
        target: "src/server/fn",
        message:
          "Gateways must not import server functions — imports flow downward only (ADR-0016).",
      },
      {
        target: "src/components",
        message: "Gateways never import components (ADR-0016).",
      },
    ],
  },
  {
    layer: "src/entities",
    bans: [
      {
        target: "src/routes",
        message:
          "Entities import nothing from the layers above — routes are above entities (ADR-0016).",
      },
      {
        target: "src/server/fn",
        message:
          "Entities import nothing from the layers above — server functions are above entities (ADR-0016).",
      },
      {
        target: "src/gateways",
        message:
          "Entities import nothing from the layers above — gateways are above entities (ADR-0016).",
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
