import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import lint from "./oxlint.project.ts";

// `bun run smoke` names a directory of its own here, so its local D1 and R2
// start empty and the rate-limit rows it writes never reach `bun run dev`.
const { SMOKE_STATE_DIR } = process.env;

export default defineConfig({
  lint,
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
      ".void",
      ".cloudflare",
      // `void db generate` writes these, and rewrites them on the next run.
      "db/migrations",
      // The web-security-audit skill keeps its JSON schema and validators in
      // their own formatting rather than this project's.
      ".claude/skills/web-security-audit",
      "*.md",
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            // React and Effect reach every page through the root layout, so
            // each gets a chunk of its own: left in the entry they put it past
            // Vite's 500 kB chunkSizeWarningLimit, and a chunk no application edit
            // touches stays cached across deploys.
            codeSplitting: {
              groups: [
                {
                  name: "react",
                  test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/u,
                },
                { name: "effect", test: /node_modules[\\/]effect[\\/]/u },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [
    devtools(),
    voidPlugin(
      SMOKE_STATE_DIR === undefined ? {} : { persistTo: SMOKE_STATE_DIR }
    ),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
});
