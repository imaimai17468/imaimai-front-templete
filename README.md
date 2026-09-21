# My App

TanStack Start + TypeScript + Tailwind CSS + shadcn/ui を使用したモダンな Web アプリケーションテンプレートです。

## 技術スタック

- **Framework**: TanStack Start (TanStack Router + Vite)
- **Data Fetching**: TanStack Query (SSR 統合は @tanstack/react-router-ssr-query)
- **Language**: TypeScript 7 (native compiler)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Authentication**: Better Auth (Google OAuth。dev ビルドに限り、固定ユーザーでワンクリックログインできる)
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Storage**: Cloudflare R2
- **Hosting**: Cloudflare Workers (@cloudflare/vite-plugin)
- **Code Quality**: Vite+ (`vp check` で format / lint / 型検査)
- **Testing**: Vitest + Testing Library
- **Package Manager**: Bun
- **Git Hooks**: Lefthook

## クイックスタート

```bash
git clone <your-repo-url>
cd <your-repo-name>
mise install                 # Node / Bun / actionlint / shellcheck を mise.toml の版で用意
bun run setup                # 依存・git hooks・生成ファイル・.env.local をまとめて用意
bun run dev
```

`bun run setup` は `.env.local` が無ければ `.env.local.example` からコピーします（既にあれば触りません）。入るのは仮の値なので、実サービスに繋ぐ前に編集してください。

`src/routeTree.gen.ts` は `bun run dev` と `bun run build` が生成し、ルートファイルの追加や削除に追従します。`worker-configuration.d.ts` は `bun run dev` が生成し、`wrangler.toml` の編集にも追従します（build は生成しません）。dev を起動せずに `bun run check` や `bun run test` を走らせるときだけ、先に `bun run generate-routes` と `bun run cf-typegen` を叩いてください。

[mise](https://mise.jdx.dev/) を使わない場合は、`package.json` の `engines.node` を満たす Node と、`mise.toml` が指定する版の Bun を手動で用意してください。Cursor Cloud Agent 環境では `.cursor/environment.json` が `scripts/cloud-agent-install.sh` を自動実行し、mise と依存の導入から `generate-routes` / `cf-typegen` までを済ませます（`bun install` は `--ignore-scripts` なので lefthook の hook は入りません）。shims の PATH 追記は rc ファイルを読むシェルにしか効かないため、rc を読まない非対話シェルからは `mise exec -- <コマンド>` で実行してください。

`bun run dev` は [portless](https://github.com/vercel-labs/portless) 経由で起動し、`http://my-app.localhost:1355` で開きます。linked worktree ではブランチ名の末尾がサブドメインとして前に付きます（ブランチ `fix-ui` なら `http://fix-ui.my-app.localhost:1355`）。付くのは末尾だけなので、`feat/x` と `fix/x` は同じ URL になり、`main` と `master` のブランチには何も付きません。dev サーバのポートは portless が空きから割り当てるので、worktree を並べて起動してもポートの取り合いは起きません。HTTPS が要るときは `bun run dev:https` を使います。443 を掴むので管理者権限が要ります。portless は前回のポートと TLS 設定を `~/.portless` に持っていてそちらを優先するので、どちらかへ切り替えるときは先に `bunx portless proxy stop` を実行してください。`@cloudflare/vite-plugin` により、`bun run dev` でも Cloudflare D1 / R2 バインディングが有効です。

データベース・認証・ストレージのセットアップ手順は [docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md)、デプロイ・ロールバック・シークレット運用は [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)、このテンプレートを新規プロジェクトに使う手順は [docs/FORKING.md](./docs/FORKING.md)、サーバ境界を oRPC / BFF 構成へ動かす場合の前提は [docs/SERVER_BOUNDARY.md](./docs/SERVER_BOUNDARY.md) を参照。

## Tools

- **[mise](https://mise.jdx.dev/)**：Node / Bun / actionlint / shellcheck のバージョン固定 (`mise.toml`)
- **[shadcn/ui](https://ui.shadcn.com/)**：UI components (`components.json`)
- **[TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)**：Type checker (Go-native `tsc`)
- **[Vite+](https://viteplus.dev/)**：Vite / Vitest / oxlint / oxfmt を束ねる CLI。設定は `vite.config.ts` の `lint` / `fmt` ブロックに集約される
- **[oxlint](https://oxc.rs/docs/guide/usage/linter)**：Linter (`vite.config.ts` の `lint` ブロック)
- **[oxlint-tailwindcss](https://oxlint-tailwindcss.pages.dev/)**：Tailwind CSS のクラス名検査 (`vite.config.ts` の `lint` ブロック)
- **[@shadcn/lint](https://github.com/shadcn-ui/lint)**：デザインシステムの検査 (`vite.config.ts` の `lint` ブロック)。呼び出し側が `className` でコンポーネントの見た目を上書きすると落ちる。配置に使う layout 系クラスだけが通り、見た目を変えたいときは `src/shared/ui/` 側の variant を使う
- **自作 oxlint プラグイン** (`tools/oxlint-plugins/`)：`vite.config.ts` の `lint.jsPlugins` から読み込まれる。層契約・コンポーネント命名・1ファイル1コンポーネント・テストの形（1テスト1 expect など）を機械的に強制するので、規約は文書だけでなくここにもある
- **自作 vite プラグイン** (`tools/vite-plugins/`)：`vite.config.ts` から読み込まれる。`wrangler.toml` の変更を検知して `bun run cf-typegen` を走らせ、dev 起動時は `worker-configuration.d.ts` が `wrangler.toml` より古いときだけ生成する
- **[oxlint-plugin-effect](https://github.com/cevr/effect-oxlint)**：Effect 向け追加ルール (`oxlint.effect.ts`、`vite.config.ts` の `lint.overrides` から `src/**` にかかる)。満たせないパスがあるときは、そのパスを名指しした `vite.config.ts` の override ブロックで外し、理由をその隣に書く
- **[react-doctor](https://github.com/millionco/react-doctor)**：React 向け追加ルール (`oxlint.react-doctor.ts`)
- **[oxfmt](https://oxc.rs/docs/guide/usage/formatter)**：Formatter (`vite.config.ts` の `fmt` ブロック)
- **[portless](https://github.com/vercel-labs/portless)**：dev サーバに名前付き HTTPS URL を割り当てる proxy。`bun run dev` が経由する
- **[lefthook](https://github.com/evilmartians/lefthook)**：Git hooks (`lefthook.yml`、`bun run setup` が `prepare` スクリプト経由でインストールする)
- **[fallow](https://github.com/fallow-rs/fallow)**：未使用の依存 / エクスポート / ファイルと、コードの複製の検出 (`.fallowrc.jsonc`)。CI が `bun run dead-code` と `bun run dupes`、lefthook の pre-push が `bun run dupes` を回す
- **[actionlint](https://github.com/rhysd/actionlint)**：GitHub Actions workflow checker (`mise.toml` が版を固定)
- **[shellcheck](https://www.shellcheck.net/)**：tracked な `*.sh` の静的検査。`bun run check:shell` が lefthook の pre-push と CI の両方から呼ぶ (`mise.toml` が版を固定)

## プロジェクト構成

```
src/
├── routes/                 # TanStack Router file-based routes
│   ├── __root.tsx          # Root layout (ThemeProvider, Header, Toaster)
│   ├── index.tsx           # Home page
│   ├── login.tsx           # Login page
│   ├── _authed.tsx         # Pathless layout whose beforeLoad guards its children
│   ├── _authed/profile.tsx # Profile page
│   ├── auth.auth-code-error.tsx  # OAuth failure landing page
│   └── api/                # API routes (auth catch-all, avatars)
├── gateways/               # createServerFn, its ManagedRuntime wiring, and D1 / R2 persistence
├── entities/               # Domain types and schemas
├── components/             # Shared UI components
│   ├── ui/                 # shadcn/ui primitives
│   ├── shared/             # Cross-page shared components
│   └── features/           # Feature-specific components
├── lib/
│   ├── auth/               # Better Auth 設定
│   ├── cloudflare/         # CloudflareEnv helper (cloudflare:workers)
│   ├── drizzle/            # Drizzle ORM スキーマ
│   ├── storage/            # R2 ストレージ
│   └── utils.ts
├── test/                   # Test helpers (router harness, cloudflare:workers stub)
├── router.tsx              # TanStack Router definition
├── ssr.tsx                 # Server entry (Cloudflare Worker handler)
├── test-setup.ts           # Vitest setup
└── styles.css              # Tailwind v4 tokens
```

配置と import 方向の規約は [AGENTS.md](./AGENTS.md) の `Rules` を参照してください。

## AI エージェントで開発する

エージェント運用層は4つでできています。

- **[AGENTS.md](./AGENTS.md)**：規約の本体。毎セッション自動でロードされます（`CLAUDE.md` はこれを読み込むだけ）
- **`.claude/rules/`**：規約の分冊。path scope を持つものは対象ファイルを編集するときだけ、持たないものは毎セッション読み込まれます
- **`.claude/skills/`**：名前のついた作業の手順。チケット粒度の作業は `ticket-work` が持ち、AGENTS.md はそれを指します
- **`.claude/hooks/`**：規約を機械的に強制する側。SessionStart で依存の欠落を報告し、Bash 実行前にガードを掛け、Stop ではコードが変わった turn だけ `bun run check`（format / lint / 型検査）と `bun run test` を回します。markdown のリンク切れ検査は変更があれば毎回走ります。ツリー全体を判定する検査は Stop に置かず、`fallow dead-code` は CI、`fallow dupes` は pre-push と CI の両方が回します。ここまでの検査はどれもビルドの成果物を動かさないので、CI は最後に `bun run smoke` を回します。ビルドした Worker を workerd で起動して 2 本のルートに HTTP リクエストを投げる検査で、ビルドが通ってから全リクエストで例外を投げる Worker はここでしか落ちません
- **Cursor**：`.cursor/rules/` は `.claude/rules/` の symlink。skills と agents は `.claude/` をそのまま読む（`.cursor/skills/` や `.cursor/agents/` は置かない）

コミット前のレビューは `code-reviewer` エージェントが担い、PR ブランチへのコミットと push はエージェントが AGENTS.md の規律に従って自分で行います。`main` へは PR 経由でだけ入ります。

## shadcn/ui

```bash
bunx shadcn@latest add [component-name]
```

## 参考リンク

- [TanStack Start](https://tanstack.com/start/)
- [TanStack Router](https://tanstack.com/router/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Better Auth](https://www.better-auth.com/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [oxc (oxlint/oxfmt)](https://oxc.rs/)
- [oxlint-tailwindcss](https://oxlint-tailwindcss.pages.dev/)
- [@shadcn/lint](https://github.com/shadcn-ui/lint)
- [fallow](https://docs.fallow.tools/)
- [oxlint-plugin-effect](https://github.com/cevr/effect-oxlint)
- [Vitest](https://vitest.dev/)
