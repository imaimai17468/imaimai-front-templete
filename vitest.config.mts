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
    isolate: false,
    setupFiles: ["./src/test-setup.ts"],
    // AGENTS.md「純関数は分岐カバレッジ 100%」の機械化。include が対象の
    // 全リスト — 新しい純関数モジュールをテスト付きで追加したらここにも足す。
    coverage: {
      include: [
        "src/entities/**",
        "src/lib/storage/avatar-validation.ts",
        "src/lib/utils.ts",
        "tools/oxlint-plugins/arch-rules.js",
        "tools/oxlint-plugins/style-rules.js",
      ],
      thresholds: {
        perFile: true,
        branches: 100,
      },
    },
  },
});
