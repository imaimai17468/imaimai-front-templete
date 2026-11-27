import { isComponentName } from "./component-names.js";
import { isTestStem, srcPathOf, stripSourceExtension } from "./file-paths.js";
import { layerOf } from "./layers.js";

const COMPONENT_WRAPPERS = new Set(["forwardRef", "memo"]);

const wrapperName = (callee) => {
  if (callee?.type === "Identifier") {
    return callee.name;
  }
  if (callee?.type === "MemberExpression") {
    return callee.property.name;
  }
  return null;
};

/**
 * Whether this initializer produces a component.
 *
 * `memo(() => …)` and `forwardRef(() => …)` are components, where every other
 * call is not, which is what keeps `Route = createFileRoute(...)(...)` out.
 */
const isFunctionInit = (init) => {
  if (
    init?.type === "ArrowFunctionExpression" ||
    init?.type === "FunctionExpression"
  ) {
    return true;
  }
  if (
    init?.type === "CallExpression" &&
    COMPONENT_WRAPPERS.has(wrapperName(init.callee))
  ) {
    return isFunctionInit(init.arguments[0]);
  }
  return false;
};

/**
 * The component-named function declarations a module-scope statement holds,
 * reading through an `export` wrapper to the declaration under it.
 *
 * Reading `Program.body` is what reaches a declaration the file never exports.
 * Visiting `VariableDeclaration` instead would reach those, and every arrow
 * nested inside a component with it.
 */
const componentsDeclaredBy = (statement) => {
  const declaration =
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (!declaration) {
    return [];
  }
  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "FunctionExpression"
  ) {
    return declaration.id && isComponentName(declaration.id.name)
      ? [declaration.id.name]
      : [];
  }
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations
      .filter(
        (declarator) =>
          isComponentName(declarator.id.name) && isFunctionInit(declarator.init)
      )
      .map((declarator) => declarator.id.name);
  }
  return [];
};

/**
 * A route file declares `Route` and imports the component it draws.
 *
 * `export const Route = createFileRoute(...)({...})` is a declarator whose
 * init is a `CallExpression`, so `Route` itself is never counted as one.
 */
const routeImportsItsComponent = {
  create(context) {
    const srcPath = srcPathOf(context);
    if (
      srcPath === null ||
      layerOf(srcPath) !== "route" ||
      isTestStem(stripSourceExtension(srcPath))
    ) {
      return {};
    }
    return {
      Program(node) {
        for (const statement of node.body) {
          for (const name of componentsDeclaredBy(statement)) {
            context.report({
              message: `A route file declares 'Route' and imports what it draws. Move '${name}' to a '-components/' directory beside this file and import it.`,
              node: statement,
            });
          }
        }
      },
    };
  },
};

export default routeImportsItsComponent;
