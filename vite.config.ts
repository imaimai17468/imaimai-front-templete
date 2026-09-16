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
import { effectRules } from "./oxlint.effect.ts";
import reactDoctor from "./oxlint.react-doctor.ts";
import { wranglerTypes } from "./tools/vite-plugins/wrangler-types-plugin.live";

const CONFIG_FILES = "*.config.{js,ts,mjs,mts}";
const FILES_VITEST_NEVER_LOADS = [CONFIG_FILES, "scripts/**"];
const CLI_ENTRYPOINTS = ["scripts/**", ".claude/hooks/**"];

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
      "./tools/oxlint-plugins/start-rules.js",
      { name: "effect", specifier: "oxlint-plugin-effect/plugin" },
      { name: "react-doctor", specifier: "oxlint-plugin-react-doctor" },
      { name: "tailwindcss", specifier: "oxlint-tailwindcss" },
      { name: "shadcn", specifier: "@shadcn/lint" },
    ],
    settings: {
      tailwindcss: {
        entryPoint: "src/styles.css",
      },
    },
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
      // Without the option the rule rewrites `<T>x` into `x as T` and lets
      // `as` through. `never` reports both forms and leaves `as const` and
      // `satisfies` alone.
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
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
      "tailwindcss/no-conflicting-classes": "error",
      "tailwindcss/no-deprecated-classes": "error",
      "tailwindcss/no-duplicate-classes": "error",
      "tailwindcss/no-unknown-classes": "error",
      "tailwindcss/enforce-canonical": "error",
      "tailwindcss/no-unnecessary-arbitrary-value": "error",
      "tailwindcss/enforce-sort-order": "error",
      "tailwindcss/consistent-variant-order": "error",
      "tailwindcss/enforce-consistent-important-position": "error",
      "tailwindcss/no-unnecessary-whitespace": "error",
      "shadcn/no-restyle": ["error", { allow: ["layout"] }],
      "shadcn/no-inline-styles": "error",
      "shadcn/require-static-classes": "error",
      "arch-rules/layer-boundaries": "error",
      "arch-rules/no-size-props": "error",
      "arch-rules/one-component-per-file": "error",
      "arch-rules/component-file-naming": "error",
      "arch-rules/test-naming-format": "error",
      "arch-rules/single-expect": "error",
      "start-rules/no-rewritten-factory-in-handler": "error",
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
        // A config object's key order carries meaning that alphabetical order
        // destroys: `plugins` runs in array order, and the blocks here read as
        // lint, then fmt, then what Vite itself needs.
        files: [CONFIG_FILES],
        rules: { "sort-keys": "off" },
      },
      {
        files: FILES_VITEST_NEVER_LOADS,
        rules: { "vitest/require-hook": "off" },
      },
      {
        // The scripts and hooks here are run as commands, so what they write
        // to stdout is the report their caller reads rather than leftover
        // debugging, and the hook tests beside them iterate for effect rather
        // than for a value, writing a scratch file per name. The remedy
        // `no-array-for-each` asks for is `for...of`, which
        // `style-rules/no-loops` forbids.
        files: CLI_ENTRYPOINTS,
        rules: {
          "no-console": "off",
          "unicorn/no-array-for-each": "off",
        },
      },
      {
        // A script drives a command and parses its JSON stdout, so `unknown`
        // is what the input actually is, and `Record<string, unknown>` is the
        // parsed shape a type guard narrows from: that covers
        // no-unknown-parameters and no-unsafe-dictionary-type.
        files: ["scripts/**"],
        rules: {
          "anti-slop/no-unknown-parameters": "off",
          "anti-slop/no-unsafe-dictionary-type": "off",
        },
      },
      {
        // A catch clause's value is unknown by the language. This module is
        // the boundary that turns it into a structured Workers Logs object,
        // and console.error is the sink that object is written to.
        files: ["src/lib/report-error.ts"],
        rules: {
          "anti-slop/no-unknown-parameters": "off",
          "no-console": "off",
        },
      },
      {
        files: ["src/test-setup.ts"],
        rules: {
          // vitest.config.mts sets no `globals`, so this import is what
          // defines afterEach here.
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
        // shadcn CLI output. These are the rules the CLI's own files trip,
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
          "tailwindcss/no-conflicting-classes": "off",
          "tailwindcss/no-deprecated-classes": "off",
          "tailwindcss/no-duplicate-classes": "off",
          "tailwindcss/no-unknown-classes": "off",
          "tailwindcss/enforce-canonical": "off",
          "tailwindcss/no-unnecessary-arbitrary-value": "off",
          "tailwindcss/enforce-sort-order": "off",
          "tailwindcss/consistent-variant-order": "off",
          "tailwindcss/enforce-consistent-important-position": "off",
          "tailwindcss/no-unnecessary-whitespace": "off",
          "shadcn/no-restyle": "off",
        },
      },
      {
        // Effect's own rules. The scope is all of `src/` rather than the
        // layers that hold Effect today, because `lib/auth/` and `routes/api/`
        // hold some too and a glob naming layers leaves the next one outside
        // without reporting it. The two entries below are what `src/` costs:
        // a rule firing on a module that carries no Effect.
        files: ["src/**"],
        rules: effectRules,
      },
      {
        // `dev-sign-in.ts` imports no Effect. Its `catch` turns a thrown
        // rejection into the `failed` arm of `DevSignInResult`, which is the
        // shape the rule wants and cannot recognise outside Effect.
        files: ["src/lib/auth/dev-sign-in.ts"],
        rules: { "effect/noTryCatch": "off" },
      },
      {
        // The one dynamic import here loads react-grab in dev only, so binding
        // it to a name would keep the dev tool reachable from the production
        // bundle's module graph.
        files: ["src/routes/__root.tsx"],
        rules: { "effect/noDynamicImports": "off" },
      },
      {
        // Effect declares a service and each failure it raises as a class, so
        // one module here holds a `Context.Service` plus a `Schema.TaggedError`
        // per failure. `throw-new-error` reads the
        // `Schema.TaggedError<T>()("Tag", {})` call such a class extends as an
        // Error construction missing `new`, and its fix inserts `new` into the
        // `extends` clause, which then does not compile.
        files: [
          "src/gateways/**",
          "src/lib/require-context.ts",
          "src/test/defect.ts",
        ],
        rules: {
          "max-classes-per-file": "off",
          "unicorn/throw-new-error": "off",
        },
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
