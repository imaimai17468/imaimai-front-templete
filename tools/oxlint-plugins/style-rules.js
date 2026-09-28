import fs from "node:fs";
import path from "node:path";

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
 * The class strings an expression can evaluate to: a string literal, each
 * static piece of a template literal, both arms of `a && b`, `a || b` and
 * `c ? a : b`, and every argument of a `cn(...)` call. Anything computed at
 * runtime has no text to read, so it yields nothing.
 */
const classStringsIn = (expr) => {
  if (
    (expr.type === "Literal" || expr.type === "StringLiteral") &&
    typeof expr.value === "string"
  ) {
    return [expr.value];
  }
  if (expr.type === "TemplateLiteral") {
    return expr.quasis.map((quasi) => quasi.value.raw);
  }
  if (expr.type === "LogicalExpression") {
    return [...classStringsIn(expr.left), ...classStringsIn(expr.right)];
  }
  if (expr.type === "ConditionalExpression") {
    return [
      ...classStringsIn(expr.consequent),
      ...classStringsIn(expr.alternate),
    ];
  }
  if (
    expr.type === "CallExpression" &&
    expr.callee.type === "Identifier" &&
    expr.callee.name === "cn"
  ) {
    return expr.arguments.flatMap(classStringsIn);
  }
  return [];
};

/** The class strings one `className` attribute can carry. */
const classNameStrings = (node) => {
  if (node.name.name !== "className" || !node.value) {
    return [];
  }
  const val = node.value;
  if (val.type === "JSXExpressionContainer") {
    return classStringsIn(val.expression);
  }
  return classStringsIn(val);
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
  /(?<![\w-])(?:drop-|inset-|text-)?shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?(?![\w-])/gu,
  (match) =>
    `Tailwind's shadow scale '${match}' is forbidden. Hierarchy comes from surface, border, spacing and type; the two cases .claude/hooks/guidance/design.md allows (a dragged element, a sticky header over scrolled content) take a shadow token defined in src/styles.css.`
);

const noTailwindSiblingMargin = classNameRule(
  /(?<![\w-])(?:m[xytblrse]?-(?:(?!0(?![\d.]))\d+(?:\.\d+)?|px)|space-[xy]-(?:\d+(?:\.\d+)?|px))(?![\w-])/gu,
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
const SHARED_UI_ALIAS = /^@\/shared\/ui\/(?<module>[\w-]+)$/u;
const FUNCTION_COMPONENT =
  /^function (?<name>[A-Z]\w*)\((?<body>[\s\S]*?)^\}$/gmu;

/**
 * The components a shadcn module declares that never touch `className`, such
 * as `DropdownMenuTrigger` or `TooltipTrigger`: they carry behavior alone, so a
 * class passed to them, or to the child they render through `asChild`, styles
 * that child rather than restyling the primitive.
 */
const unstyledComponents = (source) =>
  new Set(
    [...source.matchAll(FUNCTION_COMPONENT)]
      .filter((match) => !match.groups.body.includes("className"))
      .map((match) => match.groups.name)
  );

/**
 * The unstyled components of the module an `@/shared/ui/<module>` import
 * names, read from the checkout the lint runs in. An import spelled another
 * way, or a module that cannot be read, yields none, so every component it
 * brings stays checked.
 */
const unstyledComponentsOf = (importSource) => {
  const module = SHARED_UI_ALIAS.exec(importSource)?.groups.module;
  if (module === undefined) {
    return new Set();
  }
  try {
    return unstyledComponents(
      fs.readFileSync(
        path.join(process.cwd(), "src/shared/ui", `${module}.tsx`),
        "utf-8"
      )
    );
  } catch {
    return new Set();
  }
};

const APPEARANCE_CLASS =
  /(?<![\w-])(?:[\w-]+:)*(?:bg|text|font|tracking|leading|rounded|border|ring|shadow|opacity|p[xytblrse]?|gap|space-[xy]|transition|duration|ease|animate|decoration|underline|italic|uppercase|lowercase|capitalize)(?:-[\w.-]+)?(?![\w-])/gu;

const jsxAttributes = (opening) =>
  opening.attributes.filter((attribute) => attribute.type === "JSXAttribute");

/**
 * Whether the primitive renders its child in its own place, which Radix's
 * `asChild` does by merging the child's className into the primitive's.
 */
const passesClassesToChild = (opening) =>
  jsxAttributes(opening).some((attribute) => attribute.name.name === "asChild");

const firstChildOpening = (element) =>
  element.children
    .filter((child) => child.type === "JSXElement")
    .slice(0, 1)
    .map((child) => child.openingElement);

/**
 * A call site of a `src/shared/ui/` primitive, and the child an `asChild`
 * primitive renders in its place, passes only the classes that place it. Its
 * color, type, spacing, shape, effects and motion belong to the primitive's
 * variants, so a screen that needs a new treatment adds a variant every other
 * screen can take.
 */
const noRestyleSharedUiAtCallSite = {
  create(context) {
    const primitives = new Set();
    return {
      ImportDeclaration(node) {
        if (!SHARED_UI_SOURCE.test(String(node.source.value))) {
          return;
        }
        const unstyled = unstyledComponentsOf(String(node.source.value));
        for (const specifier of node.specifiers) {
          if (!unstyled.has(specifier.imported?.name)) {
            primitives.add(specifier.local.name);
          }
        }
      },
      JSXElement(node) {
        const opening = node.openingElement;
        if (
          opening.name.type !== "JSXIdentifier" ||
          !primitives.has(opening.name.name)
        ) {
          return;
        }
        const primitive = opening.name.name;
        const styledOpenings = passesClassesToChild(opening)
          ? [opening, ...firstChildOpening(node)]
          : [opening];
        for (const styled of styledOpenings) {
          for (const attribute of jsxAttributes(styled)) {
            for (const str of classNameStrings(attribute)) {
              for (const match of str.match(APPEARANCE_CLASS) ?? []) {
                context.report({
                  message: `'${match}' restyles <${primitive}> at its call site. Add a variant to the primitive in src/shared/ui/ and pass the variant; a call site passes only placement classes such as width or grid position.`,
                  node: attribute,
                });
              }
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
