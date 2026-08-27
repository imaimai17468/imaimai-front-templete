import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import ultraciteReact from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import ultraciteVitest from "ultracite/oxlint/vitest";
import { defineConfig } from "vite-plus";
import reactDoctor from "./oxlint.react-doctor.ts";
import { wranglerTypes } from "./tools/vite-plugins/wrangler-types-plugin";

export default defineConfig({
  lint: {
    options: { typeAware: true, typeCheck: true },
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
      // knip cannot follow a specifier written as a string here, so it lists
      // the package under ignoreDependencies in knip.json.
      { name: "react-doctor", specifier: "oxlint-plugin-react-doctor" },
    ],
    categories: {
      correctness: "error",
      suspicious: "error",
      pedantic: "error",
      perf: "error",
      style: "error",
      restriction: "error",
      nursery: "error",
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
      // `style` enables this alongside vitest/require-hook, which asks for the
      // opposite: setup at the top level trips require-hook, setup inside a
      // hook trips this. Dropping this one leaves require-hook coherent.
      "vitest/no-hooks": "off",
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
      "worker-configuration.d.ts",
    ],
    overrides: [
      {
        // `sort-keys` is dropped because a config object's key order carries
        // meaning that alphabetical order destroys: `plugins` runs in array
        // order, and the blocks here read as lint, then fmt, then what Vite
        // itself needs. `vitest/require-hook` is dropped because it reports
        // these files' top-level statements even though a config holds no
        // tests. Every other rule still applies, and these files are linted
        // and type-checked like any other.
        files: ["*.config.{js,ts,mjs,mts}"],
        rules: { "sort-keys": "off", "vitest/require-hook": "off" },
      },
      {
        // The script drives a hook and parses its JSON stdout, so `unknown` is
        // what the input actually is, and `Record<string, unknown>` is the
        // parsed shape a type guard narrows from: that covers
        // no-unknown-parameters and no-unsafe-dictionary-type.
        // `no-array-for-each` is dropped because the remedy it asks for is
        // `for...of`, which `style-rules/no-loops` forbids. `no-console` is
        // dropped because a CLI harness's output is its interface.
        files: ["scripts/**"],
        rules: {
          "anti-slop/no-unknown-parameters": "off",
          "anti-slop/no-unsafe-dictionary-type": "off",
          "no-console": "off",
          "unicorn/no-array-for-each": "off",
          // vitest/require-hook reports these scripts' top-level statements.
          // They run their own assertions under bun and vitest never loads
          // them, so there is no hook for the work to move into.
          "vitest/require-hook": "off",
        },
      },
      {
        // Vitest loads this through setupFiles, where the afterEach registers
        // once for every test file. Wrapping it in a describe would scope the
        // cleanup to that block, and dropping the import would leave afterEach
        // undefined, because vitest.config.mts does not enable globals.
        files: ["src/test-setup.ts"],
        rules: {
          "vitest/no-importing-vitest-globals": "off",
          "vitest/require-top-level-describe": "off",
        },
      },
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
        // shadcn CLI output. These are the rules the CLI's own formatting trips,
        // so leaving them on means rewriting every generated file by hand after
        // each `shadcn add`.
        files: ["src/components/ui/**"],
        rules: {
          "func-style": "off",
          "react/function-component-definition": "off",
          "sort-keys": "off",
          "import/consistent-type-specifier-style": "off",
          "@typescript-eslint/consistent-type-definitions": "off",
          "no-negated-condition": "off",
          "unicorn/no-negated-condition": "off",
          "no-use-before-define": "off",
          "no-eq-null": "off",
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
          "jsx-a11y/no-noninteractive-tabindex": [
            "error",
            { tags: ["section"] },
          ],
        },
      },
    ],
  },
  fmt: {
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "es5",
    printWidth: 80,
    sortImports: { newlinesBetween: false },
    sortTailwindcss: {
      stylesheet: "./src/styles.css",
      functions: ["cn", "cva"],
    },
    ignorePatterns: [
      "node_modules",
      ".next",
      ".output",
      "dist",
      "build",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
      "*.md",
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    devtools(),
    tanstackStart(),
    react(),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    wranglerTypes(),
  ],
});
