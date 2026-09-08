import path from "node:path";
import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vite-plus";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "cloudflare:workers": path.resolve(
        import.meta.dirname,
        "src/test/cloudflare-workers-stub.ts"
      ),
    },
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    isolate: false,
    exclude: [...defaultExclude, ".claude/worktrees/**"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      // include のパターンに入るモジュールは既定でゲートされ、exclude が
      // 例外をパスで挙げる。例外は生成物、テストハーネス、コンポーネント、
      // そして依存を引数で受け取らず実バインディングの上でしか動かない
      // アダプタと実行スクリプト。
      include: ["src/**/*.ts", "tools/**/*.{ts,js}", "scripts/**/*.ts"],
      exclude: [
        "scripts/check-toolchain-pins.ts",
        "scripts/orchestrate.ts",
        "scripts/test-bash-guard.ts",
        // include のパターンは picomatch の contains モードで照合されるので
        // `*.ts` が `.tsx` にも当たる。コンポーネントはこの行で外れる。
        "src/**/*.tsx",
        "src/gateways/user/drizzle-store.ts",
        "src/lib/auth/actions.ts",
        "src/lib/auth/auth-client.ts",
        "src/lib/auth/auth.ts",
        "src/lib/auth/session.ts",
        "src/lib/drizzle/db.ts",
        "src/lib/drizzle/schema.ts",
        "src/lib/storage/r2.ts",
        "src/routeTree.gen.ts",
        "src/routes/api/auth.$.ts",
        "src/server/cloudflare.ts",
        "src/server/fn/profile.ts",
        "src/test/**",
        "tools/vite-plugins/wrangler-types-plugin.ts",
      ],
      thresholds: {
        perFile: true,
        branches: 100,
      },
    },
  },
});
