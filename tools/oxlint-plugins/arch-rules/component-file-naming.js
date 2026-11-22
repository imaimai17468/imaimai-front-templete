import { isComponentName } from "./component-names.js";
import { filenameOf, isTestStem, stripSourceExtension } from "./file-paths.js";

const SKIP_STEMS = new Set(["index"]);

/**
 * The component name a file's own name calls for, or `null` where the name
 * yields none: an empty or test stem, `index`, or a stem whose first character
 * does not upper-case (`__root`).
 */
const expectedComponentName = (filename) => {
  const basename = filename.slice(filename.lastIndexOf("/") + 1);
  const stem = stripSourceExtension(basename);
  if (stem === "" || SKIP_STEMS.has(stem) || isTestStem(stem)) {
    return null;
  }
  const name = stem
    .split(/[.-]/u)
    .map((part) =>
      part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)
    )
    .join("");
  return isComponentName(name) ? name : null;
};

const componentFileNaming = {
  create(context) {
    const filename = filenameOf(context);
    if (!filename) {
      return {};
    }

    const expectedName = expectedComponentName(filename);
    if (expectedName === null) {
      return {};
    }

    const checkComponentName = (name, node) => {
      if (name && isComponentName(name) && name !== expectedName) {
        context.report({
          message: `Component name '${name}' does not match file name. Expected '${expectedName}'.`,
          node,
        });
      }
    };

    return {
      ExportDefaultDeclaration(node) {
        const decl = node.declaration;
        if (!decl) {
          return;
        }
        if (
          (decl.type === "FunctionDeclaration" ||
            decl.type === "FunctionExpression") &&
          decl.id
        ) {
          checkComponentName(decl.id.name, node);
        }
      },
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) {
          return;
        }
        if (decl.type === "FunctionDeclaration" && decl.id) {
          checkComponentName(decl.id.name, node);
          return;
        }
        if (decl.type === "VariableDeclaration") {
          for (const declarator of decl.declarations) {
            const name =
              declarator.id?.type === "Identifier" ? declarator.id.name : null;
            if (!name || !isComponentName(name)) {
              continue;
            }
            const { init } = declarator;
            if (
              init &&
              (init.type === "ArrowFunctionExpression" ||
                init.type === "FunctionExpression")
            ) {
              checkComponentName(name, node);
            }
          }
        }
      },
    };
  },
};

export default componentFileNaming;
