import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import ultraciteReact from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import ultraciteVitest from "ultracite/oxlint/vitest";
import reactDoctor from "./oxlint.react-doctor.ts";

export default defineConfig({
  extends: [
    core,
    ultraciteReact,
    tanstack,
    ultraciteVitest,
    antiSlop,
    reactDoctor,
  ],
  plugins: [
    "typescript",
    "unicorn",
    "oxc",
    "react",
    "vitest",
    "import",
    "jsx-a11y",
  ],
  jsPlugins: [
    "./tools/oxlint-plugins/style-rules.js",
    "./tools/oxlint-plugins/arch-rules.js",
    { name: "react-doctor", specifier: "oxlint-plugin-react-doctor" },
  ],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
  },
  rules: {
    complexity: "error",
    "prefer-const": "error",
    "no-var": "error",
    "no-param-reassign": "error",
    "no-mutable-exports": "error",
    "prefer-readonly": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "react/react-in-jsx-scope": "off",
    "react/rules-of-hooks": "error",
    "react/button-has-type": "error",
    "react/checked-requires-onchange-or-readonly": "error",
    "react/jsx-no-target-blank": "error",
    "react/no-array-index-key": "warn",
    "react/self-closing-comp": "error",
    "react/jsx-boolean-value": "error",
    "react/jsx-curly-brace-presence": "error",
    "react/jsx-no-useless-fragment": "error",
    "react/jsx-pascal-case": "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
    "no-console": "warn",
    "@typescript-eslint/ban-ts-comment": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/consistent-type-exports": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
    "@typescript-eslint/no-deprecated": "error",
    "@typescript-eslint/no-confusing-void-expression": "error",
    "@typescript-eslint/no-mixed-enums": "error",
    "@typescript-eslint/only-throw-error": [
      "error",
      {
        allow: [
          {
            from: "package",
            package: "@tanstack/router-core",
            name: "Redirect",
          },
        ],
      },
    ],
    "@typescript-eslint/prefer-promise-reject-errors": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/promise-function-async": "error",
    "@typescript-eslint/restrict-plus-operands": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    "@typescript-eslint/strict-void-return": "error",
    "unicorn/throw-new-error": "error",
    "import/no-cycle": "error",
    "import/no-unassigned-import": "off",
    "react/jsx-no-constructed-context-values": "error",
    "vitest/no-conditional-in-test": "error",
    "style-rules/no-loops": "error",
    "style-rules/no-tailwind-arbitrary": "error",
    "style-rules/no-tailwind-opacity": "error",
    "arch-rules/layer-boundaries": "error",
    "arch-rules/no-size-props": "error",
    "arch-rules/one-component-per-file": "error",
    "arch-rules/component-file-naming": "error",
    "arch-rules/test-naming-format": "error",
    "arch-rules/single-expect": "error",
  },
  env: {
    builtin: true,
    browser: true,
    node: true,
  },
  ignorePatterns: [
    "node_modules",
    ".output",
    "dist",
    "build",
    "*.config.js",
    "*.config.ts",
    "*.config.mjs",
  ],
  overrides: [
    {
      files: ["**/*.d.ts"],
      rules: { "unicorn/require-module-specifiers": "off" },
    },
    {
      // Untyped ESLint-style plugin code walking an ESTree union. `typeof` is
      // the discriminator available here, and `no-loops` is dropped so that
      // `for...of` satisfies unicorn/no-array-for-each, whose only remedy the
      // rule otherwise forbids.
      files: ["tools/oxlint-plugins/**"],
      rules: {
        "anti-slop/no-runtime-typeof": "off",
        "style-rules/no-loops": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        "@typescript-eslint/unbound-method": "off",
      },
    },
    {
      // TanStack Start hands `.validator` whatever the client sent, so the
      // parameter is `unknown` by contract and the parse runs inside. Typing it
      // as FormData would make the `instanceof` guard read as redundant while
      // still being the only thing rejecting a malformed payload.
      files: ["src/server/fn/profile.ts"],
      rules: { "anti-slop/no-unknown-parameters": "off" },
    },
    {
      files: ["src/components/shared/code-block/code-block.tsx"],
      rules: {
        "jsx-a11y/no-noninteractive-tabindex": ["error", { tags: ["section"] }],
      },
    },
  ],
});
