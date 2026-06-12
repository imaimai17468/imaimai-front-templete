# My App

TanStack Start + TypeScript + Tailwind CSS + shadcn/ui を使用したモダンな Web アプリケーションテンプレートです。

## 技術スタック

- **Framework**: TanStack Start (TanStack Router + Vite)
- **Language**: TypeScript (tsgo)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Authentication**: Better Auth (Google OAuth)
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Storage**: Cloudflare R2
- **Hosting**: Cloudflare Workers (@cloudflare/vite-plugin)
- **Code Quality**: oxlint (linting) + oxfmt (formatting)
- **Testing**: Vitest + Testing Library
- **Package Manager**: Bun
- **Git Hooks**: Lefthook

## クイックスタート

```bash
git clone <your-repo-url>
cd <your-repo-name>
bun install
cp .env.local.example .env.local
bun run dev
```

http://localhost:5173 でアクセス。`@cloudflare/vite-plugin` により、`bun run dev` でも Cloudflare D1 / R2 バインディングが有効です。

データベース・認証・ストレージのセットアップ手順は [docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md) を参照。

AI エージェント用の Aegis ナレッジベース（`.aegis/`、gitignore 済み）は、初回の Claude Code セッション開始時に SessionStart フックが `aegis-share/`（git 管理のバンドル）から自動構築します。手動で構築する場合: `npx -y @fuwasegu/aegis share-hydrate`

## Scripts

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `bun run dev`        | Start dev server (with CF bindings via workerd) |
| `bun run build`      | Production build                               |
| `bun run preview`    | Build & preview in local workerd               |
| `bun run deploy`     | Build & deploy to Cloudflare Workers           |
| `bun run typecheck`  | Type check with tsgo                           |
| `bun run lint`       | Run oxlint                                     |
| `bun run format`     | Check formatting with oxfmt                    |
| `bun run format:fix` | Format with oxfmt                              |
| `bun run knip`       | Detect unused deps/exports/files               |
| `bun run test`       | Run tests with Vitest                          |
| `bun run cf-typegen` | Generate `CloudflareEnv` from `wrangler.toml`  |

## Tools

- **[shadcn/ui](https://ui.shadcn.com/)** — UI components (`components.json`)
- **[tsgo](https://github.com/microsoft/typescript-go)** — Type checker (`@typescript/native-preview`)
- **[oxlint](https://oxc.rs/docs/guide/usage/linter)** — Linter (`.oxlintrc.json`)
- **[oxfmt](https://oxc.rs/docs/guide/usage/formatter)** — Formatter (`.oxfmtrc.json`)
- **[lefthook](https://github.com/evilmartians/lefthook)** — Git hooks (`lefthook.yml`)
- **[knip](https://knip.dev/)** — Unused deps/exports/files detection (`knip.json`)
- **[similarity-ts](https://github.com/mizchi/similarity)** — Code similarity detector

### similarity-ts のインストール

`similarity-ts` は Rust 製のため `cargo` が必要です。別途インストールしてプロジェクトルートから実行：

```bash
cargo install similarity-ts

similarity-ts ./src                  # デフォルト
similarity-ts ./src --print          # マッチしたコードを表示
similarity-ts ./src --threshold 0.7  # デフォルトは 0.85
```

Stop quality gate hook が自動実行するので、手動実行は調査時のみ。

## プロジェクト構成

```
src/
├── routes/                 # TanStack Router file-based routes
│   ├── __root.tsx          # Root layout (ThemeProvider, Header, Toaster)
│   ├── index.tsx           # Home page
│   ├── login.tsx           # Login page
│   ├── profile.tsx         # Profile page (auth guard via beforeLoad)
│   └── api/                # API routes (auth catch-all, avatars)
├── server/
│   ├── cloudflare.ts       # CloudflareEnv helper (cloudflare:workers)
│   └── fn/                 # Server functions (createServerFn)
├── components/             # Shared UI components
│   ├── ui/                 # shadcn/ui primitives
│   ├── shared/             # Cross-page shared components
│   └── features/           # Feature-specific components
├── lib/
│   ├── auth/               # Better Auth 設定
│   ├── drizzle/            # Drizzle ORM スキーマ
│   ├── storage/            # R2 ストレージ
│   └── utils.ts
├── router.tsx              # TanStack Router definition
├── client.tsx              # Browser entry (hydrateRoot)
├── ssr.tsx                 # Server entry (Cloudflare Worker handler)
└── styles.css              # Tailwind v4 tokens
```

各ページの機能別コンポーネントは `src/components/features/<feature>/` にコロケーションします。

## AI エージェントで開発する

このリポジトリは Claude Code (および superpowers / aegis MCP) を前提に組まれています。フロー全体・hook 構成・aegis / superpowers の役割分担などは:

- **[docs/agent-workflow.md](./docs/agent-workflow.md)** — タスクの流れ・常時動いている層・メンテナンスループ・特殊フローの全体像
- **[AGENTS.md](./AGENTS.md)** — 常時ロードされるコーディング規約 (凝縮版を直接記載、ADR-0008)
- **[docs/adr/README.md](./docs/adr/README.md)** — 主要設計判断の長期記録 (なぜ今こう決まっているのか)

`/start-workflow` は ticket 粒度の作業をエージェントが検知して自律的に invoke します（手動でも呼べます）。trivial な 1 行修正・config 1 値・docs only な変更はこのフローに乗せず直接編集します。コミット・PR はエージェントが AGENTS.md の規律に従って提案し、ユーザー確認後に実行します。

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
