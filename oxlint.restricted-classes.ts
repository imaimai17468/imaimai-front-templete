const PALETTE =
  "slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";

/**
 * The Tailwind classes the design system rules out, by what each one rules
 * out. `tailwindcss/no-restricted-classes` compiles each pattern with no flags
 * and tests it against one class at a time, variant prefix included.
 */
export const restrictedClasses = {
  arbitraryValue: {
    message:
      "an arbitrary value is forbidden. Use an existing utility class or add a token to src/styles.css.",
    pattern: String.raw`\w+-\[[^\]]+\]`,
  },
  easeIn: {
    message:
      "it starts slow and reads as lag on UI. Use ease-out for entering and exiting, ease-in-out for moving on screen.",
    pattern: String.raw`(?<![\w-])ease-in(?![\w-])`,
  },
  opacityModifier: {
    message:
      "an opacity modifier is forbidden. Use a different shade class, or add a dedicated color token to src/styles.css.",
    pattern: String.raw`\b(?:text|bg|border|ring|shadow|accent|caret|fill|stroke|outline|decoration)-[\w-]+\/\d+`,
  },
  paletteColor: {
    message:
      "a palette color is forbidden in a component. Use a semantic token (primary, muted-foreground, destructive, border…) from src/styles.css.",
    pattern: String.raw`(?<![\w-])(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|inset-shadow|text-shadow|fill|stroke|from|via|to|outline|decoration|divide|placeholder|caret|accent|shadow)-(?:${PALETTE})(?:-\d+)?(?![\w-])`,
  },
  shadowScale: {
    message:
      "Tailwind's shadow scale is forbidden. Hierarchy comes from surface, border, spacing and type; the two cases .claude/hooks/guidance/design.md allows (a dragged element, a sticky header over scrolled content) take a shadow token defined in src/styles.css.",
    pattern: String.raw`(?<![\w-])(?:drop-|inset-|text-)?shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner))?(?![\w-])`,
  },
  siblingMargin: {
    message:
      "it spaces siblings with a margin. Put `gap-*` on the flex or grid parent instead; `mx-auto` and negative margins stay allowed.",
    pattern: String.raw`(?<![\w-])(?:m[xytblrse]?-(?:(?!0(?![\d.]))\d+(?:\.\d+)?|px)|space-[xy]-(?:\d+(?:\.\d+)?|px))(?![\w-])`,
  },
  transitionAll: {
    message:
      "it animates whatever else changes. Name the property: transition-transform, transition-opacity or transition-colors.",
    pattern: String.raw`(?<![\w-])transition-all(?![\w-])`,
  },
} as const;

export const restrictedClassPatterns = Object.values(restrictedClasses);
