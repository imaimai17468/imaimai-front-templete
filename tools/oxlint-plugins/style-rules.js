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

/**
 * The string parts of one `className` attribute: a string literal, a string
 * inside `{}`, or each static piece of a template literal. An expression
 * computed at runtime has no text to read, so it yields nothing.
 */
const classNameStrings = (node) => {
  if (node.name.name !== "className") {
    return [];
  }
  const val = node.value;
  if (!val) {
    return [];
  }
  if (val.type === "Literal" || val.type === "StringLiteral") {
    return [String(val.value)];
  }
  if (val.type !== "JSXExpressionContainer") {
    return [];
  }
  const expr = val.expression;
  if (expr.type === "TemplateLiteral") {
    return expr.quasis.map((quasi) => quasi.value.raw);
  }
  if (
    (expr.type === "Literal" || expr.type === "StringLiteral") &&
    typeof expr.value === "string"
  ) {
    return [expr.value];
  }
  return [];
};

/**
 * A rule that reports every match of `pattern` in a `className` attribute,
 * with the message `describe` builds from the matched text.
 */
const classNameRule = (pattern, describe) => ({
  create(context) {
    return {
      JSXAttribute(node) {
        for (const str of classNameStrings(node)) {
          for (const match of str.match(pattern) ?? []) {
            context.report({ message: describe(match.trim()), node });
          }
        }
      },
    };
  },
});

const noTailwindArbitrary = classNameRule(
  /\w+-\[[^\]]+\]/gu,
  (match) =>
    `Tailwind arbitrary value '${match}' is forbidden. Use existing utility classes or add a token to src/styles.css.`
);

const noTailwindOpacity = classNameRule(
  /\b(?:text|bg|border|ring|shadow|accent|caret|fill|stroke|outline|decoration)-[\w-]+\/\d+/gu,
  (match) =>
    `Tailwind opacity modifier '${match}' is forbidden. Use a different shade class instead, or add a dedicated color token to src/styles.css.`
);

const PALETTE =
  "slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";

const noTailwindPaletteColor = classNameRule(
  new RegExp(
    String.raw`(?<![\w-])(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|inset-shadow|text-shadow|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)-(?:${PALETTE})(?:-\d+)?(?![\w-])`,
    "gu"
  ),
  (match) =>
    `Palette color '${match}' is forbidden in a component. Use a semantic token (primary, muted-foreground, destructive, border…) from src/styles.css.`
);

const noTailwindShadow = classNameRule(
  /(?<![\w-])(?:drop-)?shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?(?![\w-])/gu,
  (match) =>
    `Tailwind's shadow scale '${match}' is forbidden. Hierarchy comes from surface, border, spacing and type; the two cases .claude/hooks/guidance/design.md allows (a dragged element, a sticky header over scrolled content) take a shadow token defined in src/styles.css.`
);

const noTailwindSiblingMargin = classNameRule(
  /(?<![\w-])(?:m[xytblrse]?-(?:\d+(?:\.\d+)?|px)|space-[xy]-[\w.]+)(?![\w-])/gu,
  (match) =>
    `'${match}' spaces siblings with a margin. Put \`gap-*\` on the flex or grid parent instead; \`mx-auto\` and negative margins stay allowed.`
);

const noTailwindTransitionAll = classNameRule(
  /(?<![\w-])transition-all(?![\w-])/gu,
  () =>
    "'transition-all' animates whatever else changes. Name the property: transition-transform, transition-opacity or transition-colors."
);

const noTailwindEaseIn = classNameRule(
  /(?<![\w-])ease-in(?![\w-])/gu,
  () =>
    "'ease-in' starts slow and reads as lag on UI. Use ease-out for entering and exiting, ease-in-out for moving on screen."
);

const SHARED_UI_SOURCE = /(?:^|\/)shared\/ui\//u;

const APPEARANCE_CLASS =
  /(?<![\w-])(?:[\w-]+:)*(?:bg|text|font|tracking|leading|rounded|border|ring|shadow|opacity|p[xytblrse]?|gap|space-[xy]|transition|duration|ease|animate|decoration|underline|italic|uppercase|lowercase|capitalize)(?:-[\w.-]+)?(?![\w-])/gu;

/**
 * A call site of a `src/shared/ui/` primitive passes only the classes that
 * place it. Its color, type, spacing, shape, effects and motion belong to the
 * primitive's variants, so a screen that needs a new treatment adds a variant
 * every other screen can take.
 */
const noRestyleSharedUiAtCallSite = {
  create(context) {
    const primitives = new Set();
    return {
      ImportDeclaration(node) {
        if (!SHARED_UI_SOURCE.test(String(node.source.value))) {
          return;
        }
        for (const specifier of node.specifiers) {
          primitives.add(specifier.local.name);
        }
      },
      JSXOpeningElement(node) {
        if (
          node.name.type !== "JSXIdentifier" ||
          !primitives.has(node.name.name)
        ) {
          return;
        }
        const attributes = node.attributes.filter(
          (attribute) => attribute.type === "JSXAttribute"
        );
        for (const attribute of attributes) {
          for (const str of classNameStrings(attribute)) {
            for (const match of str.match(APPEARANCE_CLASS) ?? []) {
              context.report({
                message: `'${match}' restyles <${node.name.name}> at its call site. Add a variant to the primitive in src/shared/ui/ and pass the variant; a call site passes only placement classes such as width or grid position.`,
                node: attribute,
              });
            }
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
    "no-restyle-shared-ui-at-call-site": noRestyleSharedUiAtCallSite,
    "no-tailwind-arbitrary": noTailwindArbitrary,
    "no-tailwind-ease-in": noTailwindEaseIn,
    "no-tailwind-opacity": noTailwindOpacity,
    "no-tailwind-palette-color": noTailwindPaletteColor,
    "no-tailwind-shadow": noTailwindShadow,
    "no-tailwind-sibling-margin": noTailwindSiblingMargin,
    "no-tailwind-transition-all": noTailwindTransitionAll,
  },
};

export default plugin;
