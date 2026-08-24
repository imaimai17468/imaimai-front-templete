const noLoops = {
  create(context) {
    const report = (node) =>
      context.report({
        message:
          "Loops are forbidden. Use functional alternatives: map, filter, reduce, flatMap, forEach, some, every, find.",
        node,
      });
    return {
      DoWhileStatement: report,
      ForInStatement: report,
      ForOfStatement: report,
      ForStatement: report,
      WhileStatement: report,
    };
  },
};

const ARBITRARY_RE = /\w+-\[[^\]]+\]/gu;

const noTailwindArbitrary = {
  create(context) {
    const checkString = (str, node) => {
      const matches = str.match(ARBITRARY_RE);
      if (!matches) {
        return;
      }
      for (const match of matches) {
        context.report({
          message: `Tailwind arbitrary value '${match}' is forbidden. Use existing utility classes or add a token to globals.css.`,
          node,
        });
      }
    };

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") {
          return;
        }
        const val = node.value;
        if (!val) {
          return;
        }
        if (val.type === "Literal" || val.type === "StringLiteral") {
          checkString(String(val.value), node);
        } else if (val.type === "JSXExpressionContainer") {
          const expr = val.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkString(quasi.value.raw, node);
            }
          } else if (
            (expr.type === "Literal" || expr.type === "StringLiteral") &&
            typeof expr.value === "string"
          ) {
            checkString(expr.value, node);
          }
        }
      },
    };
  },
};

const OPACITY_RE =
  /\b(?:text|bg|border|ring|shadow|accent|caret|fill|stroke|outline|decoration)-[\w-]+\/\d+/gu;

const noTailwindOpacity = {
  create(context) {
    const checkString = (str, node) => {
      const matches = str.match(OPACITY_RE);
      if (!matches) {
        return;
      }
      for (const match of matches) {
        context.report({
          message: `Tailwind opacity modifier '${match}' is forbidden. Use a different shade class instead, or add a dedicated color token to globals.css.`,
          node,
        });
      }
    };

    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") {
          return;
        }
        const val = node.value;
        if (!val) {
          return;
        }
        if (val.type === "Literal" || val.type === "StringLiteral") {
          checkString(String(val.value), node);
        } else if (val.type === "JSXExpressionContainer") {
          const expr = val.expression;
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              checkString(quasi.value.raw, node);
            }
          } else if (
            (expr.type === "Literal" || expr.type === "StringLiteral") &&
            typeof expr.value === "string"
          ) {
            checkString(expr.value, node);
          }
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "style-rules" },
  rules: {
    "no-loops": noLoops,
    "no-tailwind-arbitrary": noTailwindArbitrary,
    "no-tailwind-opacity": noTailwindOpacity,
  },
};

export default plugin;
