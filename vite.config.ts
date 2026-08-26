import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { wranglerTypes } from "./tools/vite-plugins/wrangler-types-plugin";

export default defineConfig({
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
