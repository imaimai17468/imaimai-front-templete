import path from "node:path";
import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vite-plus";

const COVERED_ROOTS = "{src,scripts,tools}";

export const coverageInclude = [`${COVERED_ROOTS}/**/*.ts`, "tools/**/*.js"];

// coverage の gate から外れる条件はファイル名。実依存を配線するだけの
// モジュールは `*.live.ts`、コマンドとして実行されるファイルは `*.entry.ts`
// と名付ければ、この配列を編集せずに外れる。パスで並ぶのは、改名がまだの
// ファイルと、名前を別の何かが決めているファイル。
export const coverageExclude = [
  "src/**/*.gen.ts",
  // include の `*.ts` は picomatch の contains モードで照合されるので `.tsx`
  // にも当たる。コンポーネントはこの行で外れる。
  "src/**/*.tsx",
  "src/test/**",
  `${COVERED_ROOTS}/**/*.entry.ts`,
  `${COVERED_ROOTS}/**/*.live.ts`,
  "scripts/orchestrate.ts",
  // ファイル名が URL を決めるファイルルートで、`auth.$` が `/api/auth/$` を
  // 生む。改名するとその URL が変わる。
  "src/routes/api/auth.$.ts",
];

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
      include: coverageInclude,
      exclude: coverageExclude,
      thresholds: {
        perFile: true,
        branches: 100,
      },
    },
  },
});
