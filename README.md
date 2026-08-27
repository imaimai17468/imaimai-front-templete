# My App

TanStack Start + TypeScript + Tailwind CSS + shadcn/ui を使用したモダンな Web アプリケーションテンプレートです。

## 技術スタック

- **Framework**: TanStack Start (TanStack Router + Vite)
- **Language**: TypeScript 7 (native compiler)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Authentication**: Better Auth (Google OAuth)
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
mise install                 # Node / Bun / actionlint を mise.toml の版で用意
cargo install similarity-ts  # Stop gate の重複検出（Rust 製）
bun install
cp .env.local.example .env.local
bun run dev
```

`src/routeTree.gen.ts` は `bun run dev` と `bun run build` が生成し、ルートファイルの追加や削除に追従します。`worker-configuration.d.ts` は `bun run dev` が生成し、`wrangler.toml` の編集にも追従します（build は生成しません）。dev を起動せずに `bun run check` や `bun run test` を走らせるときだけ、先に `bun run generate-routes` と `bun run cf-typegen` を叩いてください。

`similarity-ts` が無い環境では SessionStart の env-check が欠落を報告し、Stop gate は重複検出を「スキップした」と明示します（黙って合格扱いにはなりません）。

[mise](https://mise.jdx.dev/) を使わない場合は、`package.json` の `engines.node` を満たす Node と、`mise.toml` が指定する版の Bun を手動で用意してください。Cursor Cloud Agent 環境では `.cursor/environment.json` が同じセットアップ（`scripts/cloud-agent-install.sh`）を自動実行します。shims の PATH 追記は rc ファイルを読むシェルにしか効かないため、rc を読まない非対話シェルからは `mise exec -- <コマンド>` で実行してください。

http://localhost:5173 でアクセス。`@cloudflare/vite-plugin` により、`bun run dev` でも Cloudflare D1 / R2 バインディングが有効です。

データベース・認証・ストレージのセットアップ手順は [docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md)、デプロイ・ロールバック・シークレット運用は [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)、このテンプレートを新規プロジェクトに使う手順は [docs/FORKING.md](./docs/FORKING.md)、サーバ境界を oRPC / BFF 構成へ動かす場合の前提は [docs/SERVER_BOUNDARY.md](./docs/SERVER_BOUNDARY.md) を参照。

## Tools

- **[mise](https://mise.jdx.dev/)**：Node / Bun / actionlint のバージョン固定 (`mise.toml`)
- **[shadcn/ui](https://ui.shadcn.com/)**：UI components (`components.json`)
- **[TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)**：Type checker (Go-native `tsc`)
- **[Vite+](https://viteplus.dev/)**：Vite / Vitest / oxlint / oxfmt を束ねる CLI。設定は `vite.config.ts` の `lint` / `fmt` ブロックに集約される
- **[oxlint](https://oxc.rs/docs/guide/usage/linter)**：Linter (`vite.config.ts` の `lint` ブロック)
- **自作 oxlint プラグイン** (`tools/oxlint-plugins/`)：`vite.config.ts` の `lint.jsPlugins` から読み込まれる。層契約・コンポーネント命名・1ファイル1コンポーネント・テストの形（1テスト1 expect など）を機械的に強制するので、規約は文書だけでなくここにもある
- **自作 vite プラグイン** (`tools/vite-plugins/`)：`vite.config.ts` から読み込まれる。`wrangler.toml` の変更を検知して `bun run cf-typegen` を走らせ、dev 起動時は `worker-configuration.d.ts` が `wrangler.toml` より古いときだけ生成する
- **[react-doctor](https://github.com/millionco/react-doctor)**：React 向け追加ルール (`oxlint.react-doctor.ts`)
- **[oxfmt](https://oxc.rs/docs/guide/usage/formatter)**：Formatter (`vite.config.ts` の `fmt` ブロック)
- **[lefthook](https://github.com/evilmartians/lefthook)**：Git hooks (`lefthook.yml`、`bun install` 時に `prepare` スクリプトで自動セットアップ)
- **[knip](https://knip.dev/)**：Unused deps/exports/files detection (`knip.json`)
- **[similarity-ts](https://github.com/mizchi/similarity)**：Code similarity detector
- **[actionlint](https://github.com/rhysd/actionlint)**：GitHub Actions workflow checker (`mise.toml` が版を固定)

## プロジェクト構成

```
src/
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
├── components/             # Shared UI components
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
└── styles.css              # Tailwind v4 tokens
```

配置と import 方向の規約は [AGENTS.md](./AGENTS.md) の `Rules` を参照してください。

## AI エージェントで開発する

エージェント運用層は4つでできています。

- **[AGENTS.md](./AGENTS.md)**：規約の本体。毎セッション自動でロードされます（`CLAUDE.md` はこれを読み込むだけ）
- **`.claude/rules/`**：規約の分冊。path scope を持つものは対象ファイルを編集するときだけ、持たないものは毎セッション読み込まれます
- **`.claude/skills/`**：名前のついた作業の手順。チケット粒度の作業は `ticket-work` が持ち、AGENTS.md はそれを指します
- **`.claude/hooks/`**：規約を機械的に強制する側。SessionStart で依存の欠落を報告し、Bash 実行前にガードを掛け、Stop で品質ゲート（typecheck / lint / format / knip / similarity / markdown リンク）を回します

コミット前のレビューは `code-reviewer` エージェントが担い、コミットと PR はエージェントが AGENTS.md の規律に従って提案してユーザー確認後に実行します。

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
- [Vitest](https://vitest.dev/)
