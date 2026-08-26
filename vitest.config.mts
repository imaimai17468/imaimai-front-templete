import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "cloudflare:workers": resolve(
        import.meta.dirname,
        "src/test/cloudflare-workers-stub.ts"
      ),
    },
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    isolate: false,
    setupFiles: ["./src/test-setup.ts"],
    // include が対象の全リスト。新しい純関数モジュールを
    // テスト付きで追加したらここにも足す。
    coverage: {
      include: [
        "src/components/shared/mode-toggle/theme-cycle.ts",
        "src/entities/**",
        "src/lib/storage/avatar-validation.ts",
        "src/lib/utils.ts",
        "tools/oxlint-plugins/arch-rules.js",
        "tools/oxlint-plugins/style-rules.js",
        "tools/vite-plugins/wrangler-types.ts",
      ],
      thresholds: {
        perFile: true,
        branches: 100,
      },
    },
  },
});
