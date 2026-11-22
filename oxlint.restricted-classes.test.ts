import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { restrictedClasses } from "./oxlint.restricted-classes.ts";

// The lint rule tests one class at a time, so the cases below do the same. It
// compiles each pattern with no flags and silently drops one that fails to
// compile; a pattern that compiles under `u` also compiles without it, so a
// broken pattern throws here instead.
const matches = (key: keyof typeof restrictedClasses, className: string) =>
  new RegExp(restrictedClasses[key].pattern, "u").test(className);

describe.each<{
  key: keyof typeof restrictedClasses;
  flagged: readonly string[];
  allowed: readonly string[];
}>([
  {
    allowed: ["w-full", "grid-cols-2"],
    flagged: ["w-[13px]", "bg-[#fff]", "hover:h-[2rem]"],
    key: "arbitraryValue",
  },
  {
    allowed: ["bg-primary", "w-1/2"],
    flagged: ["bg-primary/50", "text-muted-foreground/20", "ring-ring/10"],
    key: "opacityModifier",
  },
  {
    allowed: ["bg-primary", "text-muted-foreground", "border-border"],
    flagged: [
      "bg-red-500",
      "text-white",
      "border-x-red-500",
      "border-t-white",
      "ring-offset-white",
      "inset-shadow-black",
      "hover:bg-blue-200",
    ],
    key: "paletteColor",
  },
  {
    allowed: ["shadow-none", "shadow-lifted"],
    flagged: [
      "shadow",
      "drop-shadow-md",
      "shadow-inner",
      "inset-shadow-sm",
      "text-shadow-sm",
    ],
    key: "shadowScale",
  },
  {
    allowed: [
      "mx-auto",
      "-mx-2",
      "my-auto",
      "gap-2",
      "m-0",
      "mt-0",
      "space-x-reverse",
    ],
    flagged: ["mr-2", "mt-0.5", "space-y-4", "m-px"],
    key: "siblingMargin",
  },
  {
    allowed: ["transition-transform", "transition-colors"],
    flagged: ["transition-all"],
    key: "transitionAll",
  },
  {
    allowed: ["ease-out", "ease-in-out"],
    flagged: ["ease-in"],
    key: "easeIn",
  },
])("$key", ({ allowed, flagged, key }) => {
  it("should match every class when the class is one the pattern rules out", () => {
    expect(
      flagged.filter((className) => !matches(key, className))
    ).toStrictEqual([]);
  });

  it("should match none when the classes are ones the pattern leaves alone", () => {
    expect(
      allowed.filter((className) => matches(key, className))
    ).toStrictEqual([]);
  });
});

describe("paletteColor against the pinned Tailwind", () => {
  const themeCss = fs.readFileSync(
    path.resolve(import.meta.dirname, "node_modules/tailwindcss/theme.css"),
    "utf-8"
  );
  const palettes = [...themeCss.matchAll(/--color-(?<name>[a-z]+)-500:/gu)].map(
    (match) => match.groups?.name ?? ""
  );

  it("should match bg-<name>-500 when name is any palette the installed theme defines", () => {
    expect(
      palettes.filter((name) => !matches("paletteColor", `bg-${name}-500`))
    ).toStrictEqual([]);
  });
});
