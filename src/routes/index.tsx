import { createFileRoute } from "@tanstack/react-router";
import { CodeBlock } from "@/components/shared/code-block/code-block";

const SETUP = `git clone https://github.com/imaimai17468/imaimai-front-templete.git
cd imaimai-front-templete
mise install                 # Node / Bun を mise.toml の版で用意
cargo install similarity-ts  # Stop gate の重複検出（Rust 製）
bun install
bun run generate-routes
bun run cf-typegen
cp .env.local.example .env.local
bun run dev`;

const TREE = `src/
├── routes/                 # TanStack Router file-based routes
│   ├── __root.tsx          # Root layout (ThemeProvider, Header, Toaster)
│   ├── index.tsx           # Home page
│   ├── login.tsx           # Login page
│   ├── profile.tsx         # Profile page (auth guard via beforeLoad)
│   ├── auth.auth-code-error.tsx  # OAuth failure landing page
│   └── api/                # API routes (auth catch-all, avatars)
├── server/
│   ├── cloudflare.ts       # CloudflareEnv helper (cloudflare:workers)
│   └── fn/                 # Server functions (createServerFn)
├── gateways/               # D1 / R2 persistence
├── entities/               # Domain types and schemas
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── shared/             # Cross-page shared components
│   └── features/           # Feature-specific components
├── lib/
│   ├── auth/               # Better Auth 設定
│   ├── drizzle/            # Drizzle ORM スキーマ
│   ├── storage/            # R2 ストレージ
│   └── utils.ts
├── test/                   # Test helpers (router harness, cloudflare:workers stub)
├── router.tsx              # TanStack Router definition
├── ssr.tsx                 # Server entry (Cloudflare Worker handler)
├── test-setup.ts           # Vitest setup
└── styles.css              # Tailwind v4 tokens`;

const SPECS = [
  {
    heading: "同梱されているもの",
    rows: [
      {
        term: "認証",
        detail:
          "Better Auth と Google OAuth。/login でサインインし、/profile は beforeLoad が未認証を弾く",
      },
      { term: "データ", detail: "Cloudflare D1 と Drizzle ORM" },
      {
        term: "ファイル",
        detail: "Cloudflare R2。プロフィール画像のアップロードが動く",
      },
      {
        term: "UI",
        detail:
          "shadcn/ui（new-york）と Tailwind CSS v4。bunx shadcn@latest add [component-name] で足す",
      },
      {
        term: "言語",
        detail: "TypeScript 7。型検査は Go 実装の tsc が走る",
      },
      { term: "テスト", detail: "Vitest と Testing Library" },
      {
        term: "実行環境",
        detail:
          "Cloudflare Workers。@cloudflare/vite-plugin により bun run dev でも D1 と R2 のバインディングが有効",
      },
      { term: "パッケージ", detail: "Bun。バージョンは mise.toml が固定する" },
    ],
  },
  {
    heading: "自動で走る検査",
    rows: [
      {
        term: "層の契約",
        detail:
          "routes → server/fn → gateways → entities。逆向きの import は tools/oxlint-plugins が落とす",
      },
      {
        term: "コミット前",
        detail:
          "staged なファイルに oxlint --type-aware と oxfmt --check（lefthook）",
      },
      {
        term: "push 前",
        detail: "bun run check と bun run typecheck（lefthook）",
      },
      {
        term: "テスト",
        detail:
          "純関数のモジュールは分岐 100% を vitest.config.mts が per-file で強制する",
      },
      {
        term: "未使用",
        detail: "knip が未使用の依存とエクスポートとファイルを検出する",
      },
      {
        term: "重複",
        detail:
          "similarity-ts が重複を検出する。無い環境では Stop gate が similarity: SKIPPED と明示する",
      },
      {
        term: "React",
        detail: "oxlint-plugin-react-doctor が React 向けの追加ルールを掛ける",
      },
    ],
  },
  {
    heading: "エージェントで開発する",
    rows: [
      {
        term: "AGENTS.md",
        detail:
          "規約の本体。毎セッション読み込まれる（CLAUDE.md はこれを読み込むだけ）",
      },
      {
        term: ".claude/rules/",
        detail:
          "規約の分冊。path scope を持つものは対象ファイルを編集するときだけ読み込まれる",
      },
      {
        term: ".claude/skills/",
        detail:
          "名前のついた作業の手順。チケット粒度の作業は ticket-work が持つ",
      },
      {
        term: ".claude/hooks/",
        detail:
          "規約を機械的に強制する側。SessionStart で依存の欠落を報告し、Bash 実行前にガードを掛け、Stop で品質ゲートを回す",
      },
    ],
  },
] as const;

const LINKS = [
  { name: "TanStack Start", href: "https://tanstack.com/start/" },
  { name: "TanStack Router", href: "https://tanstack.com/router/" },
  { name: "Tailwind CSS", href: "https://tailwindcss.com/docs" },
  { name: "shadcn/ui", href: "https://ui.shadcn.com/" },
  { name: "Better Auth", href: "https://www.better-auth.com/" },
  { name: "Cloudflare D1", href: "https://developers.cloudflare.com/d1/" },
  { name: "Cloudflare R2", href: "https://developers.cloudflare.com/r2/" },
  {
    name: "@cloudflare/vite-plugin",
    href: "https://developers.cloudflare.com/workers/vite-plugin/",
  },
  {
    name: "TypeScript 7",
    href: "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/",
  },
  { name: "oxlint", href: "https://oxc.rs/docs/guide/usage/linter" },
  { name: "oxfmt", href: "https://oxc.rs/docs/guide/usage/formatter" },
  { name: "react-doctor", href: "https://github.com/millionco/react-doctor" },
  { name: "lefthook", href: "https://github.com/evilmartians/lefthook" },
  { name: "knip", href: "https://knip.dev/" },
  { name: "similarity-ts", href: "https://github.com/mizchi/similarity" },
  { name: "Vitest", href: "https://vitest.dev/" },
  { name: "mise", href: "https://mise.jdx.dev/" },
] as const;

const HomeComponent = () => (
  <div className="flex flex-col gap-12 pb-16">
    <section className="flex flex-col gap-3">
      <h1 className="text-2xl font-medium tracking-tight">
        imaimai-front-templete
      </h1>
      <p className="max-w-prose text-muted-foreground">
        TanStack Start を Cloudflare Workers
        で動かすフルスタックテンプレート。認証とデータベースとストレージは配線済みで、規約は文書だけでなく
        lint プラグインと git hook にも置いてある。
      </p>
      <a
        href="https://github.com/imaimai17468/imaimai-front-templete"
        target="_blank"
        rel="noopener noreferrer"
        className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:opacity-70"
      >
        GitHub
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>

    <section className="flex flex-col gap-3">
      <h2 className="text-base font-medium">セットアップ</h2>
      <CodeBlock label="セットアップコマンド" code={SETUP} />
      <p className="max-w-prose text-sm text-muted-foreground">
        http://localhost:5173 でアクセスできる。
        <code className="font-mono text-foreground">
          src/routes/index.tsx
        </code>{" "}
        を編集して開発を始められます。
      </p>
      <p className="max-w-prose text-sm text-muted-foreground">
        mise を使わない場合は、
        <code className="font-mono text-foreground">package.json</code> の
        engines.node を満たす Node と{" "}
        <code className="font-mono text-foreground">mise.toml</code>{" "}
        が指定する版の Bun を手動で用意する。rc を読まないシェルからは{" "}
        <code className="font-mono text-foreground">mise exec --</code>{" "}
        を通す。Cursor Cloud Agent では{" "}
        <code className="font-mono text-foreground">
          .cursor/environment.json
        </code>{" "}
        が同じセットアップを自動実行する。
      </p>
    </section>

    <section className="flex flex-col gap-3">
      <h2 className="text-base font-medium">ファイル構成</h2>
      <CodeBlock label="src ディレクトリの構成" code={TREE} />
      <p className="max-w-prose text-sm text-muted-foreground">
        配置と import 方向の規約は{" "}
        <code className="font-mono text-foreground">AGENTS.md</code> の Rules
        にある。
      </p>
    </section>

    {SPECS.map((spec) => (
      <section key={spec.heading} className="flex flex-col gap-3">
        <h2 className="text-base font-medium">{spec.heading}</h2>
        <dl className="flex flex-col gap-3">
          {spec.rows.map((row) => (
            <div
              key={row.term}
              className="flex flex-col gap-1 sm:flex-row sm:gap-6"
            >
              <dt className="text-sm font-medium text-foreground sm:w-36 sm:shrink-0">
                {row.term}
              </dt>
              <dd className="max-w-prose text-sm text-muted-foreground">
                {row.detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    ))}

    <section className="flex flex-col gap-3">
      <h2 className="text-base font-medium">参考リンク</h2>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:opacity-70"
            >
              {link.name}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>

    <p className="max-w-prose text-sm text-muted-foreground">
      データベースと認証の設定は{" "}
      <code className="font-mono text-foreground">docs/DATABASE_SETUP.md</code>
      、デプロイとロールバックは{" "}
      <code className="font-mono text-foreground">docs/DEPLOYMENT.md</code>
      、新規プロジェクトへの流用は{" "}
      <code className="font-mono text-foreground">docs/FORKING.md</code>
      、サーバ境界を動かす前提は{" "}
      <code className="font-mono text-foreground">docs/SERVER_BOUNDARY.md</code>
      。
    </p>
  </div>
);

export const Route = createFileRoute("/")({
  component: HomeComponent,
});
