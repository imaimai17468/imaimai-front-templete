import path from "node:path";
import react from "@vitejs/plugin-react";
import { defaultExclude, defineConfig } from "vite-plus";

const COVERED_ROOTS = "{src,scripts,tools}";

export const coverageInclude = [`${COVERED_ROOTS}/**/*.ts`, "tools/**/*.js"];

// coverage の gate から外れる条件はファイル名。コマンドとして実行される
// ファイルは `*.entry.ts` と名付ければ、この配列を編集せずに外れる。パスで
// 並ぶ 2 本は、ファイル名をこの規約の外が決めていて、改名するとその外側まで
// 書き換わる。
export const coverageExclude = [
  "src/**/*.gen.ts",
  // include の `*.ts` は picomatch の contains モードで照合されるので `.tsx`
  // にも当たる。コンポーネントはこの行で外れる。
  "src/**/*.tsx",
  "src/test/**",
  `${COVERED_ROOTS}/**/*.entry.ts`,
  // `.claude/settings.json` の allow ルール `Bash(bun scripts/orchestrate.ts *)`
  // がこのパスを名指すので、改名はその設定ファイルの編集になる。
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
    // Restores every spy before each test, which is what a per-file
    // `afterEach(() => vi.restoreAllMocks())` did in the two suites that had
    // one, and now covers the suites that did not. It does not reach timers or
    // the DOM: `src/test/render.tsx` and `tooltip.test.tsx` register their own
    // teardown per call, which holds whichever way `isolate` is set.
    restoreMocks: true,
    // `isolate: false` shares a worker between files, so an `import.meta.env`
    // stub a test leaves behind reaches the files that run after it.
    unstubEnvs: true,
    // `src/components/ui/` is shadcn CLI output, so a test there reaches
    // Radix's behaviour and `cn`, which `src/lib/utils.test.ts` covers.
    exclude: [
      ...defaultExclude,
      ".claude/worktrees/**",
      "src/components/ui/**",
    ],
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
