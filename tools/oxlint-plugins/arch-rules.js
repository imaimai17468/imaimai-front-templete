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
    const filename = context.filename || context.getFilename?.();
    if (!filename) return {};

    const basename = filename.split("/").pop() || "";
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

const plugin = {
  meta: { name: "arch-rules" },
  rules: {
    "no-size-props": noSizeProps,
    "one-component-per-file": oneComponentPerFile,
    "component-file-naming": componentFileNaming,
    "test-naming-format": testNamingFormat,
    "single-expect": singleExpect,
  },
};

export default plugin;
