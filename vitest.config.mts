import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "cloudflare:workers": resolve(
        __dirname,
        "src/test/cloudflare-workers-stub.ts",
      ),
    },
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    passWithNoTests: true,
    isolate: false,
    setupFiles: ["./src/test-setup.ts"],
  },
});
